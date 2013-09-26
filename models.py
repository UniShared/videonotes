# Copyright (C) 2013 UniShared Inc.
#
# Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
#
# The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
#
# THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

# Add the library location to the path
import sys
sys.path.insert(0, 'lib')

from google.appengine.ext import db
from google.appengine.ext.db import EmailProperty, StringProperty
from oauth2client.appengine import CredentialsProperty

__author__ = 'arnaud@videonot.es Arnaud BRETON (UniShared)'

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