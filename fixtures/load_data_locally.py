
import sys
from fixture import GoogleDatastoreFixture
import os
import optparse
from fixture.style import NamedDataStyle

def main():
    p = optparse.OptionParser(usage="%prog [options]")
    default = "/tmp/dev_appserver.datastore"
    p.add_option("--datastore_path", default=default, help=(
                    "Path to datastore file.  This must match the value used for "
                    "the same option when running dev_appserver.py if you want to view the data.  "
                    "Default: %s" % default))
    default = "/tmp/dev_appserver.datastore.history"
    p.add_option("--history_path", default=default, help=(
                    "Path to datastore history file.  This doesn't need to match the one you use for "
                    "dev_appserver.py.  Default: %s" % default))
    default = "/usr/local/google_appengine"
    p.add_option("--google_path", default=default, help=(
                    "Path to google module directory.  Default: %s" % default))
    (options, args) = p.parse_args()
    
    if not os.path.exists(options.google_path):
        p.error("Could not find google module path at %s.  You'll need to specify the path" % options.google_path)
        
    groot = options.google_path
    sys.path.append(groot)
    sys.path.append(os.path.join(groot, "lib/antlr3"))
    sys.path.append(os.path.join(groot, "lib/fancy_urllib"))
    sys.path.append(os.path.join(groot, "lib/webob-1.2.3"))
    sys.path.append(os.path.join(groot, "lib/yaml/lib"))
    sys.path.append('..')
    sys.path.append('../lib')

    from google.appengine.tools import dev_appserver
    import models
    from fixtures import language_holywood

    config, explicit_matcher, from_cache = dev_appserver.LoadAppConfig('..', {})
    dev_appserver.SetupStubs(
        config.application, 
            clear_datastore = False, # just removes the files when True
            datastore_path = options.datastore_path, 
            history_path = options.history_path,
            blobstore_path= '',
            login_url = None)
    
    datafixture = GoogleDatastoreFixture(env=models, style=NamedDataStyle())
    
    data = datafixture.data(language_holywood.WeeksData, language_holywood.CourseData)
    data.setup()
    print "Data loaded into datastore %s" % (options.datastore_path or "[default]")

if __name__ == '__main__':
    main()