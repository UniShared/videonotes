# Add the library location to the path
import sys
sys.path.insert(0, 'lib')

from google.appengine.ext import db
from google.appengine.ext.db import EmailProperty, StringProperty
from oauth2client.appengine import CredentialsProperty

__author__ = 'Arnaud BRETON (UniShared)'

class Credentials(db.Model):
    """Datastore entity for storing OAuth2.0 credentials.

    The CredentialsProperty is provided by the Google API Python Client, and is
    used by the Storage classes to store OAuth 2.0 credentials in the data store."""
    credentials = CredentialsProperty()

class EvernoteCredentials(db.Model):
    credentials = StringProperty()

class RegisteredUser(db.Model):
    """
    Datastore entity for storing User properties
    """

    email = EmailProperty()