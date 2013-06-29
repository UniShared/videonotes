#!/usr/bin/python
#
# Copyright (C) 2012 Google Inc.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#      http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
# Add the library location to the path
import sys
sys.path.insert(0, 'lib')

__author__ = 'afshar@google.com (Ali Afshar)'
__author__ = 'arnaud@videonot.es (Arnaud BRETON)'

from evernote_handlers import AuthEvernoteHandler, ExportEvernoteHandler
import urllib
from base_handlers import BaseHandler, BaseDriveHandler
import urlparse
from utils import FileUtils, DriveState
import os
import httplib2
import random
from google.appengine.api import urlfetch
import time
from BufferedSmtpHandler import BufferingSMTPHandler
from httplib import HTTPException
from apiclient.errors import HttpError
import webapp2
from models import CourseModel
from apiclient.http import MediaUpload
from oauth2client.client import flow_from_clientsecrets
from oauth2client.client import AccessTokenRefreshError
from oauth2client.appengine import simplejson as json
import logging
from utils import SibPath


# Configure error logger
logger = logging.getLogger("error")
logger.setLevel(logging.ERROR)
logger.addHandler(BufferingSMTPHandler(5))

# Configure URLFetch deadline
urlfetch.set_default_fetch_deadline(45)
httplib2.Http(timeout=45)

# Load the secret that is used for client side sessions
# Create one of these for yourself with, for example:
# python -c "import os; print os.urandom(64)" > session-secret
SESSION_SECRET = open(SibPath('session.secret')).read()

class HomePage(BaseHandler):
    """Web handler for the main page.

    Handles requests and returns the user interface for Open With and Create
    cases. Responsible for parsing the state provided from the Drive UI and acting
    appropriately.
    """

    TEMPLATE = 'index.html'

    def get(self, *args):
        """Handle GET for Create New and Open With.

        This creates an authorized client, and checks whether a resource id has
        been passed or not. If a resource ID has been passed, this is the Open
        With use-case, otherwise it is the Create New use-case.
        """
        # Generate a state instance for the request, this includes the action, and
        # the file id(s) that have been sent from the Drive user interface.

        return self.RenderTemplate(HomePage.TEMPLATE)

class EditPage(BaseDriveHandler):
    """Web handler for the main page.

    Handles requests and returns the user interface for Open With and Create
    cases. Responsible for parsing the state provided from the Drive UI and acting
    appropriately.
    """

    TEMPLATE = 'index.html'

    def get(self, *args):
        """Handle GET for Create New and Open With.

        This creates an authorized client, and checks whether a resource id has
        been passed or not. If a resource ID has been passed, this is the Open
        With use-case, otherwise it is the Create New use-case.
        """
        # Generate a state instance for the request, this includes the action, and
        # the file id(s) that have been sent from the Drive user interface.
        user_agent = self.request.headers.get('User-Agent', None)
        if user_agent == 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)':
            logging.debug('Returning template for scraper %s', user_agent)
            return self.RenderTemplate(EditPage.TEMPLATE)

        drive_state = DriveState.FromRequest(self.request)
        logging.debug('Drive state %s', drive_state.action)
        if drive_state.action == 'open' and len(drive_state.ids) > 0:
            code = self.request.get('code')
            if code:
                code = '?code=%s' % code
            self.redirect('/edit/%s%s' % (drive_state.ids[0], code))
            return
        elif 'resource_id' in self.session and self.session['resource_id']:
            logging.debug('Restoring resource ID')
            resource_id = self.session['resource_id']
            del self.session['resource_id']
            return self.redirect('/edit/' + resource_id)
        elif drive_state.action == 'create':
            if drive_state.parent:
                self.redirect('/edit/?parent={0}'.format(drive_state.parent))
                return

        creds = self.GetCodeCredentials() or self.GetSessionCredentials()
        if not creds:
            logging.debug('No credentials')
            resource_id_in_url = self.request.url.split('?', 1)[0].rsplit('/', 1)[1]
            if resource_id_in_url:
                logging.debug('Saving resource ID from URL %s', resource_id_in_url)
                self.session['resource_id'] = resource_id_in_url
            logging.debug('Redirecting to auth handler')
            return self.redirect('/auth')

        return self.RenderTemplate(EditPage.TEMPLATE)

class ServiceHandler(BaseDriveHandler):
    """Web handler for the service to read and write to Drive."""

    def get(self):
        """Called when HTTP GET requests are received by the web application.

        Use the query parameter file_id to fetch the required file's metadata then
        content and return it as a JSON object.

        Since DrEdit deals with text files, it is safe to dump the content directly
        into JSON, but this is not the case with binary files, where something like
        Base64 encoding is more appropriate.
        """
        try:
            f = self.get_file(self.request.get('file_id'))
            f = FileUtils.transformations(f)

            self.RespondJSON(f)
        except AccessTokenRefreshError:
            # Catch AccessTokenRefreshError which occurs when the API client library
            # fails to refresh a token. This occurs, for example, when a refresh token
            # is revoked. When this happens the user is redirected to the
            # Authorization URL.
            logging.info('AccessTokenRefreshError')
            return self.abort(401)

    def post(self):
        """
        Called when HTTP POST requests are received by the web application.

        The POST body is JSON which is deserialized and used as values to create a
        new file in Drive. The authorization access token for this action is
        retrieved from the data store.
        """

        # Create a Drive service
        service = self.CreateDrive()
        if service is None:
            return

        # Load the data that has been posted as JSON
        logging.debug('Get JSON data')
        data = self.RequestJSON()
        logging.debug('JSON data retrieved %s', json.dumps(data))

        content = FileUtils.get_content_from_data(data)

        max_try = 5
        for n in range(0, max_try):
            try:
                if 'templateId' in data:
                    body = {'title': 'Your notes'}
                    resource = service.files().copy(fileId=data['templateId'], body=body).execute()
                else:
                    # Create a new file data structure.
                    resource = {
                        'title': data['title'],
                        'description': data['description'],
                        'mimeType': data['mimeType'],
                    }

                    if 'parent' in data and data['parent']:
                        logging.debug('Creating from a parent folder %s', data['parent'])
                        default_folder_id = data['parent']
                    else:
                        if 'defaultFolderId' in self.session and self.session['defaultFolderId']:
                            default_folder_id = self.session['defaultFolderId']
                        else:
                            default_folder_list = service.files().list(q='title="VideoNot.es"').execute()
                            if default_folder_list and 'items' in default_folder_list and len(default_folder_list['items']):
                                default_folder_id = default_folder_list['items'][0]['id']
                                self.session['defaultFolderId'] = default_folder_id
                            else:
                                folder_ressource = {
                                    'title': 'VideoNot.es',
                                    'mimeType': 'application/vnd.google-apps.folder'
                                }
                                default_folder = service.files().insert(body=folder_ressource).execute()
                                default_folder_id = default_folder['id']
                                self.session['defaultFolderId'] = default_folder_id
                    resource['parents'] = [{'id':default_folder_id}]

                    # Make an insert request to create a new file. A MediaInMemoryUpload
                    # instance is used to upload the file body.
                    logging.debug('Calling Drive API with content %s', str(content))
                    resource = service.files().insert(
                        body=resource,
                        media_body=MediaInMemoryUpload(
                            content,
                            data['mimeType'],
                            resumable=True)
                    ).execute()

                    if BaseHandler.is_production():
                        clement_permission = {
                            'value': 'clement@videonot.es',
                            'type': 'user',
                            'role': 'reader'
                        }

                        anyone_permission = {
                            'type': 'anyone',
                            'role': 'reader',
                            'withLink': True
                        }

                        try:
                            logging.info('Add Clement as a reader')
                            service.permissions().insert(fileId=resource['id'], body=clement_permission).execute()
                        except HttpError:
                            logging.info('Error when adding Clement as a reader')

                        try:
                            logging.info('Add anyone as a reader')
                            service.permissions().insert(fileId=resource['id'], body=anyone_permission).execute()
                        except HttpError:
                            logging.info('Error when adding anyone as a reader')

                # Respond with the new file id as JSON.
                logging.debug('New ID created %s', resource['id'])
                return self.RespondJSON({'id': resource['id']})
            except AccessTokenRefreshError:
                # In cases where the access token has expired and cannot be refreshed
                # (e.g. manual token revoking) redirect the user to the authorization page
                # to authorize.
                logging.info('AccessTokenRefreshError')
                return self.abort(401)
            except HttpError, http_error:
                logging.getLogger("error").exception("Try #%d: Exception occurred when creating file", n)
                # HTTP status code 403 indicates that the app is not authorized to save the file (third-party app disabled, user without access, etc.)
                # Don't need to try several times
                if http_error.resp.status == 403:
                    return self.abort(403)
                else:
                    time.sleep((2 ** n) + (random.randint(0, 1000) / 1000))
            except HTTPException:
                logging.getLogger("error").exception("Try #%d: Exception occurred when creating file", n)
                time.sleep((2 ** n) + (random.randint(0, 1000) / 1000))

        logging.getLogger("error").exception("Exception occurred when creating file after %d tries", max_try)
        return self.abort(500)

    def put(self):
        """
        Called when HTTP PUT requests are received by the web application.

        The PUT body is JSON which is deserialized and used as values to update
        a file in Drive. The authorization access token for this action is
        retreived from the data store.
        """

        # Create a Drive service
        service = self.CreateDrive()
        if service is None:
            return

        # Load the data that has been posted as JSON
        logging.debug('Get JSON data')
        data = self.RequestJSON()
        logging.debug('JSON data retrieved %s', json.dumps(data))

        logging.info('Updating file %s', data['id'])

        # Create a new file data structure.
        content = FileUtils.get_content_from_data(data)
        #data['indexableText'] = {'text': content['content']}

        max_try = 5
        for n in range(0, max_try):
            try:
                if content is not None:
                    # Make an update request to update the file. A MediaInMemoryUpload
                    # instance is used to upload the file body. Because of a limitation, this
                    # request must be made in two parts, the first to update the metadata, and
                    # the second to update the body.
                    resource = service.files().update(
                        fileId=data['id'],
                        newRevision=self.request.get('newRevision', False),
                        body=data,
                        media_body=MediaInMemoryUpload(
                            content, data['mimeType'], resumable=True)
                    ).execute()
                else:
                    # Only update the metadata, a patch request is prefered but not yet
                    # supported on Google App Engine; see
                    # http://code.google.com/p/googleappengine/issues/detail?id=6316.
                    resource = service.files().update(
                        fileId=data['id'],
                        newRevision=self.request.get('newRevision', False),
                        body=data).execute()
                    # Respond with the new file id as JSON.
                return self.RespondJSON({'id': resource['id']})
            except HttpError, http_error:
                logging.getLogger("error").exception("Try #%d: Exception occurred when updating file", n)
                # HTTP status code 403 indicates that the app is not authorized to save the file (third-party app disabled, user without access, etc.)
                # Don't need to try several times
                if http_error.resp.status == 403:
                    return self.abort(403)
                else:
                    time.sleep((2 ** n) + (random.randint(0, 1000) / 1000))
            except HTTPException:
                logging.getLogger("error").exception("Try #%d: Exception occurred when updating file", n)
                time.sleep((2 ** n) + (random.randint(0, 1000) / 1000))
            except AccessTokenRefreshError:
                # Catch AccessTokenRefreshError which occurs when the API client library
                # fails to refresh a token. This occurs, for example, when a refresh token
                # is revoked. When this happens the user is redirected to the
                # Authorization URL.
                logging.info('AccessTokenRefreshError')
                return self.abort(401)

        logging.getLogger("error").exception("Exception occurred when updating file after %d tries", max_try)
        return self.abort(500)

class AuthHandler(BaseDriveHandler):
    def get(self):
        creds = self.GetCodeCredentials() or self.GetSessionCredentials()

        if not creds:
            logging.debug('No credentials, redirecting to Oauth2 URL')
            next = self.request.get('next')
            if next and BaseHandler.is_authorized_domain(next):
                self.session['next'] = next

            file_id = self.request.get('file_id')
            if file_id:
                self.session['fileId'] = file_id

            redirect_uri = self.RedirectAuth()
            return self.redirect(redirect_uri)

        if 'next' in self.session:
            next = self.session['next']
            del self.session['next']
            params = {'videonotes_start': 1}

            if 'fileId' in self.session:
                file_id = self.session['fileId']
                del self.session['fileId']
                if file_id:
                    params.update({'videonotes_id': file_id})

            url_parts = list(urlparse.urlparse(next))
            query = dict(urlparse.parse_qsl(url_parts[4]))
            query.update(params)

            url_parts[4] = urllib.urlencode(query)

            return self.redirect(str(urlparse.urlunparse(url_parts)))
        else:
            return self.redirect('/edit/')


class UserHandler(BaseDriveHandler):
    """Web handler for the service to read user information."""

    def get(self):
        """Called when HTTP GET requests are received by the web application."""
        # Create a Drive service

        service = self.CreateUserInfo()
        if service is None:
            return self.abort(401)
        try:
            logging.debug('Get user informations')
            result = service.userinfo().get().execute()
            # Generate a JSON response with the file data and return to the client.
            self.RespondJSON(result)
        except AccessTokenRefreshError:
            # Catch AccessTokenRefreshError which occurs when the API client library
            # fails to refresh a token. This occurs, for example, when a refresh token
            # is revoked. When this happens the user is redirected to the
            # Authorization URL.
            return self.abort(401)


class ProxyHandler(BaseHandler):
    def get(self):
        url = self.request.get('q')

        logging.debug('Fetch URL %s', url)
        if BaseHandler.is_authorized_domain(url):
            logging.debug('Authorized domain URL %s', url)
            result = urlfetch.fetch(url)
            if result.status_code == 200:
                self.response.out.write(result.content.strip())
        else:
            logging.getLogger("error").error('Unauthorized domain %s', url)
            return self.abort(403)


class CoursesHandler(BaseHandler):
    """Web handler for the service to list courses information."""

    def get(self):
        """Called when HTTP GET requests are received by the web application."""
        return self.RespondJSON(CourseModel.all())


class AboutHandler(BaseDriveHandler):
    """Web handler for the service to read user information."""

    def get(self):
        """Called when HTTP GET requests are received by the web application."""
        # Create a Drive service
        service = self.CreateDrive()
        if service is None:
            return
        try:
            result = service.about().get().execute()
            # Generate a JSON response with the file data and return to the client.
            self.RespondJSON(result)
        except AccessTokenRefreshError:
            # Catch AccessTokenRefreshError which occurs when the API client library
            # fails to refresh a token. This occurs, for example, when a refresh token
            # is revoked. When this happens the user is redirected to the
            # Authorization URL.
            return self.abort(401)

class ConfigHandler(BaseHandler):
    def get(self):
        production = BaseHandler.is_production()

        logging.debug('Get configuration, production %s', production)
        segment_io_account = [os.environ.get('SEGMENTIO_STAGING'), os.environ.get('SEGMENTIO_PRODUCTION')][production]
        logging.debug('Segment IO account %s', segment_io_account)
        app_id = flow_from_clientsecrets('client_secrets_{0}.json'.format(self.get_version()), scope='').client_id.split('.')[0].split('-')[0]
        logging.debug('App id %s', app_id)
        config = {'segmentio': segment_io_account, 'appId': app_id}

        return self.RespondJSON(config)

class MediaInMemoryUpload(MediaUpload):
    """MediaUpload for a chunk of bytes.

    Construct a MediaFileUpload and pass as the media_body parameter of the
    method. For example, if we had a service that allowed plain text:
    """

    def __init__(self, body, mimetype='application/octet-stream',
                 chunksize=256 * 1024, resumable=False):
        """Create a new MediaBytesUpload.

        Args:
          body: string, Bytes of body content.
          mimetype: string, Mime-type of the file or default of
            'application/octet-stream'.
          chunksize: int, File will be uploaded in chunks of this many bytes. Only
            used if resumable=True.
          resumable: bool, True if this is a resumable upload. False means upload
            in a single request.
        """
        self._body = body
        self._mimetype = mimetype
        self._resumable = resumable
        self._chunksize = chunksize

    def chunksize(self):
        """Chunk size for resumable uploads.

        Returns:
          Chunk size in bytes.
        """
        return self._chunksize

    def mimetype(self):
        """Mime type of the body.

        Returns:
          Mime type.
        """
        return self._mimetype

    def size(self):
        """Size of upload.

        Returns:
          Size of the body.
        """
        return len(self._body)

    def resumable(self):
        """Whether this upload is resumable.

        Returns:
          True if resumable upload or False.
        """
        return self._resumable

    def getbytes(self, begin, length):
        """Get bytes from the media.

        Args:
          begin: int, offset from beginning of file.
          length: int, number of bytes to read, starting at begin.

        Returns:
          A string of bytes read. May be shorter than length if EOF was reached
          first.
        """
        return self._body[begin:begin + length]

# Create an WSGI application suitable for running on App Engine
config = {}
config['webapp2_extras.sessions'] = {
    'secret_key': SESSION_SECRET,
}

app = webapp2.WSGIApplication(
    [
        webapp2.Route(r'/', HomePage, 'home'),
        webapp2.Route(r'/edit/<:[A-Za-z0-9\-_]*>', EditPage, 'edit'),
        webapp2.Route(r'/courses', CoursesHandler),
        webapp2.Route(r'/svc', ServiceHandler),
        webapp2.Route(r'/about', AboutHandler),
        webapp2.Route(r'/auth', AuthHandler, 'auth'),
        webapp2.Route(r'/auth-evernote', AuthEvernoteHandler),
        webapp2.Route(r'/user', UserHandler),
        webapp2.Route(r'/config', ConfigHandler),
        webapp2.Route(r'/proxy', ProxyHandler),
        webapp2.Route(r'/export/evernote/<:[A-Za-z0-9\-_]*>', ExportEvernoteHandler),
    ],
    # XXX Set to False in production.
    debug=not BaseHandler.is_production(), config=config
)