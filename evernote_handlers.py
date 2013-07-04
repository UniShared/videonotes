import collections
from utils import FileUtils

__author__ = 'arnaud'

# Add the library location to the path
import sys
sys.path.insert(0, 'lib')

import webapp2
from base_handlers import BaseHandler, BaseDriveHandler
from evernote.api.client import EvernoteClient
from evernote.edam.type.ttypes import Note, Notebook
from evernote.edam.error.ttypes import EDAMUserException
from oauth2client.appengine import StorageByKeyName
from models import EvernoteCredentials
import logging

class BaseEvernoteHandler(BaseHandler):
    """Base request handler for Evernote applications.

    Adds Authorization support for Evernote.
    """
    EN_CONSUMER_KEY = 'videonotes'
    EN_CONSUMER_SECRET = 'c0a52fafb28eba20'

    def handle_exception(self, exception, debug):
        # If the exception is a HTTPException with 401/403 status code use its error code.
        # Otherwise let the generic handler manage it.
        if isinstance(exception, webapp2.HTTPException):
            if exception.status == 401:
                return self.redirect('/auth-evernote?next={0}'.format(self.request.path))

    def get_session_credentials(self):
        if 'evernote_user_id' in self.session:
            user_id = self.session['evernote_user_id']
            return StorageByKeyName(EvernoteCredentials, user_id, 'credentials').get()
        else:
            return None

    def get_client(self):
        return EvernoteClient(
            consumer_key=BaseEvernoteHandler.EN_CONSUMER_KEY,
            consumer_secret=BaseEvernoteHandler.EN_CONSUMER_SECRET,
            sandbox=False
        )

    def get_authorized_client(self):
        """Create an authorize service instance.

        The service can only ever retrieve the credentials from the session.

        Args:
          service: Service name (e.g 'drive', 'oauth2').
          version: Service version (e.g 'v1').
        Returns:
          Authorized service or redirect to authorization flow if no credentials.
        """
        # For the service, the session holds the credentials
        logging.debug('Creating authorized Evernote client instance')

        creds = self.get_session_credentials()
        client = self.get_client()
        if creds:
            # If the session contains credentials, use them to create a Drive service
            # instance.
            client.token = creds
            return client
        elif 'oauth_token' in self.session and 'oauth_token_secret' in self.session and self.request.get('oauth_verifier'):
            # If no credentials could be loaded from the session, redirect the user to
            # the authorization page.
            access_token = client.get_access_token(self.session['oauth_token'], self.session['oauth_token_secret'], self.request.get('oauth_verifier'))
            user_store = client.get_user_store()
            self.session['evernote_user_id'] = str(user_store.getUser().id)
            StorageByKeyName(EvernoteCredentials, self.session['evernote_user_id'], 'credentials').put(access_token)
            return client
        else:
            return None

class ExportEvernoteHandler(BaseEvernoteHandler, BaseDriveHandler):
    def get(self, file_id):
        client = self.get_authorized_client()
        if not client:
            return self.redirect('/auth-evernote?next={0}'.format(self.request.path))

        try:
            file = self.get_file(file_id)
        except webapp2.HTTPException, http_ex:
            if http_ex.code == 401:
                return self.redirect('/auth?next={0}'.format(self.request.path))

        base_url = self.request.host_url + '/edit/{0}'.format(file['id'])
        extension_loaded = bool(int(self.request.get('extensionLoaded', 1)))

        # Look for the VideoNot.es Notebook
        notestore = client.get_note_store()
        notesbooks = notestore.listNotebooks()
        notebook = None

        for a_notesbook in notesbooks:
            if a_notesbook.name == 'VideoNot.es':
                notebook = a_notesbook
                break

        if not notebook:
            notebook = Notebook()
            notebook.name = 'VideoNot.es'
            notebook = notestore.createNotebook(notebook)

        # Formatting the note in ENML
        content_enml = FileUtils.to_ENML(file, base_url)
        content_enml.append('<br></br><br></br>')

        content_enml.append('<a href="{0}">View in VideoNot.es</a>'.format(base_url))
        if not extension_loaded:
            content_enml.append('<br/>')
            content_enml.append('(Tip: you can add snapshots of the video to your export by installing our <a href="https://chrome.google.com/webstore/detail/kmbcnighpdagelfjmlbakfnciogcelgi">Chrome Extension</a>)')

        # Saving the note in Evernote
        note = Note()
        note.title = file['title']
        note_content = ''.join(content_enml).encode('utf-8')
        note.content = '<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE en-note SYSTEM "http://xml.evernote.com/pub/enml2.dtd"><en-note>{0}</en-note>'.format(note_content)
        note.content = note.content.replace('&', '&amp;')
        if notebook:
            note.notebookGuid = notebook.guid
        note = notestore.createNote(note)

        logging.debug('VideoNot.es %s exported to Evernote: %s', file_id, note_content)
        logging.info('VideoNot.es %s exported to Evernote with id: %s', file_id, note.guid)

        # Returning to the new note in Evernote
        user_store = client.get_user_store()
        notestore_url = '/'.join(user_store.getNoteStoreUrl().split('/')[0:5])
        return self.redirect(notestore_url + '/view/notebook/{0}'.format(note.guid))

class AuthEvernoteHandler(BaseEvernoteHandler):
    def get(self):
        client = self.get_client()
        next = self.request.get('next', '')
        callbackUrl = 'http://%s%s' % (
            self.request.host, next)

        request_token = client.get_request_token(callbackUrl)

        self.session['oauth_token'] = request_token['oauth_token']
        self.session['oauth_token_secret'] = request_token['oauth_token_secret']

        # Redirect the user to the Evernote authorization URL
        return self.redirect(client.get_authorize_url(request_token))