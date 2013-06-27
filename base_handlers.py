# Add the library location to the path
import os
import sys
from utils import FileUtils

sys.path.insert(0, 'lib')

from apiclient.errors import HttpError
import httplib2
from apiclient.discovery import build
import urlparse
import webapp2
from webapp2_extras import jinja2, sessions
from oauth2client.client import FlowExchangeError, flow_from_clientsecrets
from oauth2client.appengine import StorageByKeyName, simplejson as json
from models import Credentials, RegisteredUser
import logging

ALL_SCOPES = ('https://www.googleapis.com/auth/drive.install '
              'https://www.googleapis.com/auth/drive.file '
              'https://www.googleapis.com/auth/userinfo.email '
              'https://www.googleapis.com/auth/userinfo.profile')


class BaseHandler(webapp2.RequestHandler):
    AUTHORIZED_DOMAINS = [u'www.udacity.com', u'www.coursera.org']

    def handle_exception(self, exception, debug):
        # If the exception is a HTTPException, use its error code.
        # Otherwise use a generic 500 error code.
        if isinstance(exception, webapp2.HTTPException):
            # Set a custom message.
            logging.getLogger("error").error('An error occurred %s', exception.code)
            try:
                json.loads(exception.args)
                self.RespondJSON(exception.args)
            except ValueError:
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
        self.response.headers['Access-Control-Allow-Origin'] = 'https://www.udacity.com'
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

    @staticmethod
    def is_authorized_domain(url):
        parse = urlparse.urlparse(url)
        return parse.netloc in BaseHandler.AUTHORIZED_DOMAINS if parse.netloc != '' else True

class BaseDriveHandler(BaseHandler):
    """Base request handler for drive applications.

    Adds Authorization support for Drive.
    """
    def handle_exception(self, exception, debug):
        # If the exception is a HTTPException with 401/403 status code use its error code.
        # Otherwise let the generic handler manage it.
        if isinstance(exception, webapp2.HTTPException):
            if exception.code == 401:
                self.response.set_status(exception.code)
                self.RespondJSON({'redirectUri': self.RedirectAuth()})
            elif exception.code == 403:
                self.response.set_status(exception.code)
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
        client_secrets = 'client_secrets_{0}.json'.format(BaseDriveHandler.get_version())
        logging.debug('Create OAuth flow with %s', client_secrets)
        flow = flow_from_clientsecrets(client_secrets, scope='')
        # Dynamically set the redirect_uri based on the request URL. This is extremely
        # convenient for debugging to an alternative host without manually setting the
        # redirect URI.
        flow.redirect_uri = self.request.application_url + '/auth'
        return flow

    def CreateService(self, service, version, creds):
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
        users_service = self.CreateService('oauth2', 'v2', creds)

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
        uri = str(flow.step1_get_authorize_url())

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
            return self.CreateService(service, version, creds)
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

    def get_file(self, file_id):
        service = self.CreateDrive()
        if service is None:
            return

        # Requests are expected to pass the file_id query parameter.
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
                        f.update(json_content)
                    except ValueError:
                        logging.info("ValueError when decoding raw content in JSON")
                        f.update(FileUtils.get_empty_file())
                else:
                    logging.debug("No content or error response")
                    f.update(FileUtils.get_empty_file())
            else:
                logging.debug('No download URL')
                f.update(FileUtils.get_empty_file())
        else:
            f = None
            # Generate a JSON response with the file data and return to the client.

        return f