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
import uuid
from google.appengine.api import urlfetch
from google.appengine.api import taskqueue
from google.appengine.api import channel

from BufferedSmtpHandler import BufferingSMTPHandler

__author__ = 'afshar@google.com (Ali Afshar)'
__author__ = 'arnaud@videonot.es (Arnaud BRETON)'

# Add the library location to the path
import sys

sys.path.insert(0, 'lib')

import os
import httplib2
from webapp2_extras import sessions
from apiclient.discovery import build
from apiclient.errors import HttpError
import webapp2
from webapp2_extras import jinja2
from models import CourseModel, Credentials, RegisteredUser
from apiclient.http import MediaUpload
from oauth2client.client import flow_from_clientsecrets
from oauth2client.client import FlowExchangeError
from oauth2client.client import AccessTokenRefreshError
from oauth2client.appengine import StorageByKeyName
from oauth2client.appengine import simplejson as json
import logging

ALL_SCOPES = ('https://www.googleapis.com/auth/drive.install '
              'https://www.googleapis.com/auth/drive.file '
              'https://www.googleapis.com/auth/userinfo.email '
              'https://www.googleapis.com/auth/userinfo.profile')

# Configure error logger
logger = logging.getLogger("error")
logger.setLevel(logging.ERROR)
logger.addHandler(BufferingSMTPHandler(5))

def SibPath(name):
    """Generate a path that is a sibling of this file.

    Args:
      name: Name of sibling file.
    Returns:
      Path to sibling file.
    """
    return os.path.join(os.path.dirname(__file__), name)


# Load the secret that is used for client side sessions
# Create one of these for yourself with, for example:
# python -c "import os; print os.urandom(64)" > session-secret
SESSION_SECRET = open(SibPath('session.secret')).read()

def CreateService(service, version, creds):
    """Create a Google API service.

    Load an API service from a discovery document and authorize it with the
    provided credentials.

    Args:
      service: Service name (e.g 'drive', 'oauth2').
      version: Service version (e.g 'v1').
      creds: Credentials used to authorize service.
    Returns:
      Authorized Google API service.
    """
    # Instantiate an Http instance
    http = httplib2.Http()

    # Authorize the Http instance with the passed credentials
    creds.authorize(http)

    # Build a service from the passed discovery document path
    return build(service, version, http=http)


class DriveState(object):
    """Store state provided by Drive."""

    def __init__(self, state):
        """Create a new instance of drive state.

        Parse and load the JSON state parameter.

        Args:
          state: State query parameter as a string.
        """
        if state:
            state_data = json.loads(state)
            self.action = state_data['action']

            if 'folderId' in state_data:
                self.parent = state_data['folderId']
            self.ids = map(str, state_data.get('ids', []))
        else:
            self.action = 'create'
            self.parent = []

        logging.debug('Create Drive state, parent %s, action %s', unicode(self.parent) if hasattr(self, 'parent') else None, self.action)

    @classmethod
    def FromRequest(cls, request):
        """Create a Drive State instance from an HTTP request.

        Args:
          cls: Type this class method is called against.
          request: HTTP request.
        """
        return DriveState(request.get('state'))


class BaseHandler(webapp2.RequestHandler):
    def handle_exception(self, exception, debug):
        # If the exception is a HTTPException, use its error code.
        # Otherwise use a generic 500 error code.
        if isinstance(exception, webapp2.HTTPException):
            # Set a custom message.
            logging.getLogger("error").error('An error occurred %s', exception.code)
            self.response.write('An error occurred')
            self.response.set_status(exception.code)
        elif isinstance(exception, HttpError):
            try:
                # Load Json body.
                error_content = json.loads(exception.content)
                logging.exception("HTTP error %s %s", error_content.get('code'), error_content.get('message'))
                self.response.set_status(error_content.get('code', 500))
                self.response.write(error_content.get('message', 'An error occurred'))
            except ValueError:
                # Could not load Json body.
                logging.getLogger("error").error("HTTP error %s %s", exception.resp.status, exception.resp.reason)
                self.response.set_status(exception.resp.status)
                self.response.write(exception.resp.reason)
        else:
            message = 'An error occurred'
            logging.getLogger("error").error('%s : %s', message, exception, exc_info=True)
            self.response.write(message)
            self.response.set_status(500)

    def dispatch(self):
        # Get a session store for this request.
        self.session_store = sessions.get_store(request=self.request)

        try:
            # Dispatch the request.
            webapp2.RequestHandler.dispatch(self)
        finally:
            # Save all sessions.
            self.session_store.save_sessions(self.response)

    @webapp2.cached_property
    def session(self):
        # Returns a session using the default cookie key.
        return self.session_store.get_session()

    def RequestJSON(self):
        """Load the request body as JSON.

        Returns:
          Request body loaded as JSON or None if there is no request body.
        """
        if self.request.body:
            return json.loads(self.request.body)

    def RespondJSON(self, data):
        """Generate a JSON response and return it to the client.

        Args:
          data: The data that will be converted to JSON to return.
        """
        self.response.headers['Content-Type'] = 'application/json'
        self.response.out.write(json.dumps(data))

    @webapp2.cached_property
    def jinja2(self):
        # Returns a Jinja2 renderer cached in the app registry.
        return jinja2.get_jinja2(app=self.app)

    def RenderTemplate(self, template_name, context=None):
        """Render a named template in a context."""
        self.response.headers['Content-Type'] = 'text/html'

        version = {'minified': not BaseHandler.is_development_server()}
        if context:
            context.update(version)
        else:
            context = version

        self.response.write(self.jinja2.render_template(template_name, **context))

    @staticmethod
    def get_version():
        return os.environ['CURRENT_VERSION_ID'].split('.')[0]

    @staticmethod
    def is_production():
        return BaseHandler.get_version() == "production" and not BaseHandler.is_development_server()

    @staticmethod
    def is_development_server():
        return 'Development' in os.environ['SERVER_SOFTWARE']


class BaseDriveHandler(BaseHandler):
    """Base request handler for drive applications.

    Adds Authorization support for Drive.
    """
    def handle_exception(self, exception, debug):
        # If the exception is a HTTPException, use its error code.
        # Otherwise use a generic 500 error code.
        if isinstance(exception, webapp2.HTTPException):
            if exception.code == 401:
                self.response.set_status(exception.code)
                self.RespondJSON({'redirectUri': self.RedirectAuth()})
            else:
                super(BaseDriveHandler, self).handle_exception(exception, debug)
        else:
            super(BaseDriveHandler, self).handle_exception(exception, debug)

    def CreateOAuthFlow(self):
        """Create OAuth2.0 flow controller

        This controller can be used to perform all parts of the OAuth 2.0 dance
        including exchanging an Authorization code.

        Args:
          request: HTTP request to create OAuth2.0 flow for
        Returns:
          OAuth2.0 Flow instance suitable for performing OAuth2.0.
        """
        client_secrets = 'client_secrets_{0}.json'.format(os.environ['CURRENT_VERSION_ID'].split('.')[0])
        logging.debug('Create OAuth flow with %s', client_secrets)
        flow = flow_from_clientsecrets(client_secrets, scope='')
        # Dynamically set the redirect_uri based on the request URL. This is extremely
        # convenient for debugging to an alternative host without manually setting the
        # redirect URI.
        flow.redirect_uri = self.request.application_url + '/auth'
        return flow

    def GetCodeCredentials(self):
        """Create OAuth 2.0 credentials by extracting a code and performing OAuth2.0.

        The authorization code is extracted form the URI parameters. If it is absent,
        None is returned immediately. Otherwise, if it is present, it is used to
        perform step 2 of the OAuth 2.0 web server flow.

        Once a token is received, the user information is fetched from the userinfo
        service and stored in the session. The token is saved in the datastore against
        the user ID received from the userinfo service.

        Args:
          request: HTTP request used for extracting an authorization code and the
                   session information.
        Returns:
          OAuth2.0 credentials suitable for authorizing clients or None if
          Authorization could not take place.
        """
        # Other frameworks use different API to get a query parameter.
        logging.debug('Get credentials from URL')
        code = self.request.get('code')
        if not code:
            logging.debug('No code in URL')
            # returns None to indicate that no code was passed from Google Drive.
            return None

        # Auth flow is a controller that is loaded with the client information,
        # including client_id, client_secret, redirect_uri etc
        oauth_flow = self.CreateOAuthFlow()

        # Perform the exchange of the code. If there is a failure with exchanging
        # the code, return None.
        try:
            logging.debug('Oauth flow step2 exchange')
            creds = oauth_flow.step2_exchange(code)
        except FlowExchangeError:
            return None

        # Create an API service that can use the userinfo API. Authorize it with our
        # credentials that we gained from the code exchange.              ut
        users_service = CreateService('oauth2', 'v2', creds)

        # Make a call against the userinfo service to retrieve the user's information.
        # In this case we are interested in the user's "id" field.
        user = users_service.userinfo().get().execute()
        userid = user['id']

        # Store the user id in the user's cookie-based session.
        self.session['userid'] = userid

        # Store the credentials in the data store using the userid as the key.
        logging.debug('Saving credentials and email in datastore')
        StorageByKeyName(Credentials, userid, 'credentials').put(creds)
        StorageByKeyName(RegisteredUser, userid, 'email').put(user['email'])
        return creds

    def GetSessionCredentials(self):
        """Get OAuth 2.0 credentials for an HTTP session.

        If the user has a user id stored in their cookie session, extract that value
        and use it to load that user's credentials from the data store.

        Args:
          request: HTTP request to use session from.
        Returns:
          OAuth2.0 credentials suitable for authorizing clients.
        """
        # Try to load  the user id from the session
        userid = None
        if 'userid' in self.session:
            logging.debug('Get credentials for %s from session', userid)
            userid = self.session['userid']
        if not userid:
            # return None to indicate that no credentials could be loaded from the
            # session.
            return None

        # Load the credentials from the data store, using the userid as a key.
        logging.debug('Get credentials for %s from datastore', userid)
        creds = StorageByKeyName(Credentials, userid, 'credentials').get()

        # if the credentials are invalid, return None to indicate that the credentials
        # cannot be used.
        if creds and creds.invalid:
            logging.debug('Invalid credentials')
            return None

        return creds

    def RedirectAuth(self):
        """Redirect a handler to an authorization page.

        Used when a handler fails to fetch credentials suitable for making Drive API
        requests. The request is redirected to an OAuth 2.0 authorization approval
        page and on approval, are returned to application.

        Args:
          handler: webapp.RequestHandler to redirect.
        """
        logging.debug('Creating Oauth flow')
        flow = self.CreateOAuthFlow()

        # Manually add the required scopes. Since this redirect does not originate
        # from the Google Drive UI, which authomatically sets the scopes that are
        # listed in the API Console.
        logging.debug('Oauth flow scopes %s', " ".join(ALL_SCOPES))
        flow.scope = ALL_SCOPES

        # Create the redirect URI by performing step 1 of the OAuth 2.0 web server
        # flow.
        uri = str(flow.step1_get_authorize_url(flow.redirect_uri))

        # Perform the redirect.
        return str(uri)

    def CreateAuthorizedService(self, service, version):
        """Create an authorize service instance.

        The service can only ever retrieve the credentials from the session.

        Args:
          service: Service name (e.g 'drive', 'oauth2').
          version: Service version (e.g 'v1').
        Returns:
          Authorized service or redirect to authorization flow if no credentials.
        """
        # For the service, the session holds the credentials
        logging.debug('Creating %s service instance, version %s', service, version)

        creds = self.GetSessionCredentials()
        if creds:
            # If the session contains credentials, use them to create a Drive service
            # instance.
            return CreateService(service, version, creds)
        else:
            # If no credentials could be loaded from the session, redirect the user to
            # the authorization page.
            return self.abort(401)

    def CreateDrive(self):
        """Create a drive client instance."""
        return self.CreateAuthorizedService('drive', 'v2')

    def CreateUserInfo(self):
        """Create a user info client instance."""
        return self.CreateAuthorizedService('oauth2', 'v2')

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
        elif 'resource_id' in self.session and self.session['resource_id']:
            logging.debug('Restoring resource ID')
            resource_id = self.session['resource_id']
            del self.session['resource_id']
            return self.redirect('/edit/' + resource_id)

        return self.RenderTemplate(EditPage.TEMPLATE)

class GetChannelToken(BaseHandler):
    def get(self):
        client_id = str(uuid.uuid4())
        channel_token = channel.create_channel(client_id)
        self.RespondJSON({'clientId': client_id, 'channelToken': channel_token})

class ServiceHandler(BaseDriveHandler):
    """Web handler for the service to read and write to Drive."""

    def get_empty_file(self, f):
        f['content'] = {'content': ''}
        f['video'] = {'video': ''}
        f['syncNotesVideo'] = {'syncNotesVideo': {'enabled': True}}

    def get(self):
        """Called when HTTP GET requests are received by the web application.

        Use the query parameter file_id to fetch the required file's metadata then
        content and return it as a JSON object.

        Since DrEdit deals with text files, it is safe to dump the content directly
        into JSON, but this is not the case with binary files, where something like
        Base64 encoding is more appropriate.
        """
        # Create a Drive service
        service = self.CreateDrive()
        if service is None:
            return
        try:
            # Requests are expected to pass the file_id query parameter.
            file_id = self.request.get('file_id')
            logging.info('Get file %s', file_id)
            if file_id:
                # Fetch the file metadata by making the service.files().get method of
                # the Drive API.
                f = service.files().get(fileId=file_id).execute()
                downloadUrl = f.get('downloadUrl')
                # If a download URL is provided in the file metadata, use it to make an
                # authorized request to fetch the file ontent. Set this content in the
                # data to return as the 'content' field. If there is no downloadUrl,
                # just set empty content.
                if downloadUrl:
                    logging.debug('Downloading the file from %s', downloadUrl)
                    resp, raw_content = service._http.request(downloadUrl)
                    logging.debug('Response status : %s', resp.status)
                    logging.debug('Raw content : %s', raw_content)
                    if resp and resp.status == int(200) and raw_content:
                        try:
                            json_content = json.loads(raw_content)
                            f['content'] = json_content['content']
                            f['video'] = json_content['video']
                            f['syncNotesVideo'] = json_content['syncNotesVideo']
                        except ValueError:
                            logging.info("ValueError when decoding raw content in JSON")
                            self.get_empty_file(f)
                    else:
                        logging.debug("No content or error response")
                        self.get_empty_file(f)
                else:
                    logging.debug('No download URL')
                    self.get_empty_file(f)
            else:
                f = None
                # Generate a JSON response with the file data and return to the client.
            self.RespondJSON(f)
        except AccessTokenRefreshError:
            # Catch AccessTokenRefreshError which occurs when the API client library
            # fails to refresh a token. This occurs, for example, when a refresh token
            # is revoked. When this happens the user is redirected to the
            # Authorization URL.
            logging.info('AccessTokenRefreshError')
            return self.abort(401)

    def post(self):
        try:
            data = self.RequestJSON()
            logging.debug("Creating a new file")
            taskqueue.add(url='/svc-worker-post', params={'userId': self.session['userid'], 'clientId': self.request.get('clientId'), 'newRevision': self.request.get('newRevision'), 'data': json.dumps(data)}, method='POST', target=BaseHandler.get_version())
        except AccessTokenRefreshError:
            self.abort(401)

    def put(self):
        try:
            data = self.RequestJSON()
            logging.debug("Updating file %s", data['id'])
            taskqueue.add(url='/svc-worker-put', params={'userId': self.session['userid'], 'clientId': self.request.get('clientId'), 'newRevision': self.request.get('newRevision'), 'data': json.dumps(data)}, method='POST', target=BaseHandler.get_version())
        except AccessTokenRefreshError:
            self.abort(401)


class ServiceWorkerPost(BaseDriveHandler):
    def post(self):
        """Called when HTTP POST requests are received by the web application.

        The POST body is JSON which is deserialized and used as values to create a
        new file in Drive. The authorization access token for this action is
        retreived from the data store.
        """
        user_id = self.request.get('userId')
        client_id = self.request.get('clientId')

        if not user_id:
            logging.getLogger("error").error("No client id in request")
            return
        else:
            self.session['userid'] = user_id

        if not client_id:
            logging.getLogger("error").error("No client id in request")
            return

        # Create a Drive service
        service = self.CreateDrive()
        if service is None:
            return

        # Load the data that has been posted as JSON
        logging.debug('Get JSON data')
        data = json.loads(self.request.get('data'))
        logging.debug('JSON data retrieved %s', json.dumps(data))

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
                    resource['parents'] = [{'id': data['parent']}]

                # Make an insert request to create a new file. A MediaInMemoryUpload
                # instance is used to upload the file body.

                content = json.dumps({'video': data.get('video', ''), 'content': data.get('content', ''),
                                      'syncNotesVideo': data.get('syncNotesVideo', '')})
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
                        'value': 'clement@unishared.com',
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
            logging.debug('Return ID %s', resource['id'])
            channel.send_message(client_id, json.dumps({'id': resource['id']}))
        except AccessTokenRefreshError:
            # In cases where the access token has expired and cannot be refreshed
            # (e.g. manual token revoking) redirect the user to the authorization page
            # to authorize.
            return self.abort(401)
        except (HttpError, ValueError, taskqueue.Error), e:
            logging.getLogger("error").exception("Exception occurred when updating file")
            channel.send_message(client_id, json.dumps({'errorDescription': str(e)}))

class ServiceWorkerPut(BaseDriveHandler):
    def post(self):
        """Called when HTTP PUT requests are received by the web application.

        The PUT body is JSON which is deserialized and used as values to update
        a file in Drive. The authorization access token for this action is
        retreived from the data store.
        """
        user_id = self.request.get('userId')
        client_id = self.request.get('clientId')

        if not user_id:
            logging.getLogger("error").error("No client id in request")
            return
        else:
            self.session['userid'] = user_id

        if not client_id:
            logging.getLogger("error").error("No client id in request")
            return

        # Create a Drive service
        service = self.CreateDrive()
        if service is None:
            return
            # Load the data that has been posted as JSON

        try:
            data = json.loads(self.request.get('data'))
            logging.info('Updating file %s', data['id'])
            # Create a new file data structure.
            content = json.dumps({'video': data.get('video', ''), 'content': data.get('content', ''),
                                  'syncNotesVideo': data.get('syncNotesVideo', '')})
            if 'content' in data:
                data.pop('content')
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
            channel.send_message(client_id, json.dumps({'id': resource['id']}))
        except (HttpError, ValueError, taskqueue.Error), e:
            logging.getLogger("error").exception("Exception occurred when updating file")
            channel.send_message(client_id, json.dumps({'errorDescription': str(e)}))



class AuthHandler(BaseDriveHandler):
    def get(self):
        creds = self.GetCodeCredentials() or self.GetSessionCredentials()

        if not creds:
            logging.debug('No credentials, redirecting to Oauth2 URL')
            redirect_uri = self.RedirectAuth()
            return self.redirect(redirect_uri)

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
        result = urlfetch.fetch(url)
        if result.status_code == 200:
            self.response.out.write(result.content.strip())


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
        google_analytics_account = [os.environ.get('GOOGLE_ANALYTICS_ACCOUNT_STAGING'), os.environ.get('GOOGLE_ANALYTICS_ACCOUNT_PRODUCTION')][production]
        logging.debug('Google Analytics account %s', google_analytics_account)
        app_id = flow_from_clientsecrets('client_secrets_{0}.json'.format(os.environ['CURRENT_VERSION_ID'].split('.')[0]), scope='').client_id.split('.')[0].split('-')[0]
        logging.debug('App id %s', app_id)
        config = {'googleAnalyticsAccount': google_analytics_account, 'appId': app_id}

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
        webapp2.Route(r'/get-channel-token', GetChannelToken),
        webapp2.Route(r'/svc', ServiceHandler),
        webapp2.Route(r'/svc-worker-post', ServiceWorkerPost),
        webapp2.Route(r'/svc-worker-put', ServiceWorkerPut),
        webapp2.Route(r'/about', AboutHandler),
        webapp2.Route(r'/auth', AuthHandler, 'auth'),
        webapp2.Route(r'/user', UserHandler),
        webapp2.Route(r'/config', ConfigHandler),
        webapp2.Route(r'/proxy', ProxyHandler)
    ],
    # XXX Set to False in production.
    debug=not BaseHandler.is_production(), config=config
)