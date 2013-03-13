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

__author__ = 'afshar@google.com (Ali Afshar)'

import httplib2
from google.appengine.ext import db
from google.appengine.ext.webapp import template
from apiclient.discovery import build_from_document
from apiclient.http import MediaUpload
from oauth2client import client
from oauth2client.appengine import CredentialsProperty
from oauth2client.appengine import StorageByKeyName
from oauth2client.appengine import simplejson as json

import sessions


APIS_BASE = 'https://www.googleapis.com'
ALL_SCOPES = ('https://www.googleapis.com/auth/drive.file '
              'https://www.googleapis.com/auth/userinfo.email '
              'https://www.googleapis.com/auth/userinfo.profile')
CODE_PARAMETER = 'code'
STATE_PARAMETER = 'state'
SESSION_SECRET = open('session.secret').read()
DRIVE_DISCOVERY_DOC = open('drive.json').read()
USERS_DISCOVERY_DOC = open('users.json').read()


class Credentials(db.Model):
  """Datastore entity for storing OAuth2.0 credentials."""
  credentials = CredentialsProperty()


def CreateOAuthFlow(request):
  """Create OAuth2.0 flow controller

  Args:
    request: HTTP request to create OAuth2.0 flow for
  Returns:
    OAuth2.0 Flow instance suitable for performing OAuth2.0.
  """
  flow = client.flow_from_clientsecrets('client-debug.json', scope='')
  flow.redirect_uri = request.url.split('?', 1)[0].rstrip('/')
  return flow


def GetCodeCredentials(request):
  """Create OAuth2.0 credentials by extracting a code and performing OAuth2.0.

  Args:
    request: HTTP request used for extracting an authorization code.
  Returns:
    OAuth2.0 credentials suitable for authorizing clients.
  """
  code = request.get(CODE_PARAMETER)
  if code:
    oauth_flow = CreateOAuthFlow(request)
    creds = oauth_flow.step2_exchange(code)
    users_service = CreateService(USERS_DISCOVERY_DOC, creds)
    userid = users_service.userinfo().get().execute().get('id')
    request.session.set_secure_cookie(name='userid', value=userid)
    StorageByKeyName(Credentials, userid, 'credentials').put(creds)
    return creds


def GetSessionCredentials(request):
  """Get OAuth2.0 credentials for an HTTP session.

  Args:
    request: HTTP request to use session from.
  Returns:
    OAuth2.0 credentials suitable for authorizing clients.
  """
  userid = request.session.get_secure_cookie(name='userid')
  if userid:
    creds = StorageByKeyName(Credentials, userid, 'credentials').get()
    if creds and not creds.invalid:
      return creds


def CreateService(discovery_doc, creds):
  """Create a Google API service.

  Args:
    discovery_doc: Discovery doc used to configure service.
    creds: Credentials used to authorize service.
  Returns:
    Authorized Google API service.
  """
  http = httplib2.Http()
  creds.authorize(http)
  return build_from_document(discovery_doc, APIS_BASE, http=http)


def RedirectAuth(handler):
  """Redirect a handler to an authorization page.

  Args:
    handler: webapp.RequestHandler to redirect.
  """
  flow = CreateOAuthFlow(handler.request)
  flow.scope = ALL_SCOPES
  uri = flow.step1_get_authorize_url(flow.redirect_uri)
  handler.redirect(uri)


def CreateDrive(handler):
  """Create a fully authorized drive service for this handler.

  Args:
    handler: RequestHandler from which drive service is generated.
  Returns:
    Authorized drive service, generated from the handler request.
  """
  request = handler.request
  request.session = sessions.LilCookies(handler, SESSION_SECRET)
  creds = GetCodeCredentials(request) or GetSessionCredentials(request)
  if creds:
    return CreateService(DRIVE_DISCOVERY_DOC, creds)
  else:
    RedirectAuth(handler)


def ServiceEnabled(view):
  """Decorator to inject an authorized service into an HTTP handler.

  Args:
    view: HTTP request handler method.
  Returns:
    Decorated handler which accepts the service as a parameter.
  """
  def ServiceDecoratedView(handler, view=view):
    service = CreateDrive(handler)
    response_data = view(handler, service)
    handler.response.headers['Content-Type'] = 'text/html'
    handler.response.out.write(response_data)
  return ServiceDecoratedView


def ServiceEnabledJson(view):
  """Decorator to inject an authorized service into a JSON HTTP handler.

  Args:
    view: HTTP request handler method.
  Returns:
    Decorated handler which accepts the service as a parameter.
  """
  def ServiceDecoratedView(handler, view=view):
    service = CreateDrive(handler)
    if handler.request.body:
      data = json.loads(handler.request.body)
    else:
      data = None
    response_data = json.dumps(view(handler, service, data))
    handler.response.headers['Content-Type'] = 'application/json'
    handler.response.out.write(response_data)
  return ServiceDecoratedView


class DriveState(object):
  """Store state provided by Drive."""

  def __init__(self, state):
    self.ParseState(state)

  @classmethod
  def FromRequest(cls, request):
    """Create a Drive State instance from an HTTP request.

    Args:
      cls: Type this class method is called against.
      request: HTTP request.
    """
    return DriveState(request.get(STATE_PARAMETER))

  def ParseState(self, state):
    """Parse a state parameter and set internal values.

    Args:
      state: State parameter to parse.
    """
    if state.startswith('{'):
      self.ParseJsonState(state)
    else:
      self.ParsePlainState(state)

  def ParseJsonState(self, state):
    """Parse a state parameter that is JSON.

    Args:
      state: State parameter to parse
    """
    state_data = json.loads(state)
    self.action = state_data['action']
    self.ids = map(str, state_data.get('ids', []))

  def ParsePlainState(self, state):
    """Parse a state parameter that is a plain resource id or missing.

    Args:
      state: State parameter to parse
    """
    if state:
      self.action = 'open'
      self.ids = [state]
    else:
      self.action = 'create'
      self.ids = []


class MediaInMemoryUpload(MediaUpload):
  """MediaUpload for a chunk of bytes.

  Construct a MediaFileUpload and pass as the media_body parameter of the
  method. For example, if we had a service that allowed plain text:
  """

  def __init__(self, body, mimetype='application/octet-stream',
               chunksize=256*1024, resumable=False):
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


def RenderTemplate(name, **context):
  """Render a named template in a context.

  Args:
    name: Template name.
    context: Keyword arguments to render as template variables.
  """
  return template.render(name, context)
