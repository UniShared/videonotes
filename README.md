VideoNot.es
======================

The easiest way to take notes synchronized with videos!
Based on the Google Drive sample application (https://developers.google.com/drive/examples/python).

This app is under MIT licence (http://opensource.org/licenses/MIT)

Originally created by Clément DELANGUE and Arnaud BRETON for UniShared Inc.

#Configuration

You need to provide a JSON configuration.
This file must be at the root level and named config_<environment>.json (environment={production,staging})

To track events via Segment.io (https://segment.io), please provide a `segmentio` key in this file containing your account token.
For Evernote export, please provide evernote_consumer_key` and `evernote_consumer_secret keys.
To receiver error reports by email, provide a `admin_email` key.

#Deployment

This app is designed to run on the Google App Engine.
See the official documentation to deploy it on your own instances.
https://developers.google.com/appengine/

# Demo

Available on http://videonot.es
