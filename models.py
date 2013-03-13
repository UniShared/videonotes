# Add the library location to the path
import sys
sys.path.insert(0, 'lib')

from google.appengine.ext import db
from oauth2client.appengine import CredentialsProperty

__author__ = 'Arnaud BRETON (UniShared)'

class WeekModel(db.Model):
    id = db.IntegerProperty(required=True)
    videos = db.ListProperty(db.Link)

class CourseModel(db.Model):
    name = db.StringProperty(required=True)
    weeks = db.ReferenceProperty(WeekModel, collection_name='weeks')

class Credentials(db.Model):
    """Datastore entity for storing OAuth2.0 credentials.

    The CredentialsProperty is provided by the Google API Python Client, and is
    used by the Storage classes to store OAuth 2.0 credentials in the data store."""
    credentials = CredentialsProperty()