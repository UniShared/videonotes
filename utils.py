import collections
import json
import logging
import os

class FileUtils():
    LAST_FILE_VERSION = 2

    @staticmethod
    def get_empty_file():
        return {
            'version': FileUtils.LAST_FILE_VERSION,
            'content': '',
            'currentVideo': None,
            'videos': {},
            'syncNotesVideo': True
        }

    @staticmethod
    def get_content_from_data(data):
        content = json.dumps({
            'version': data.get('version', FileUtils.LAST_FILE_VERSION),
            'videos': data.get('videos', {}),
            'currentVideo': data.get('currentVideo', None),
            'content': data.get('content', ''),
            'syncNotesVideo': data.get('syncNotesVideo', True)
        })

        if 'content' in data:
            data.pop('content')

        return content

    @staticmethod
    def transformations(f):
        """
        Transform a file from a version to an another
        """
        return FileUtils.transformation_v1_to_v2(f)

    @staticmethod
    def transformation_v1_to_v2(f):
        """
        Transform a v1 file to v2
        V1: single video
        V2: multi videos support
        """

        # V1 has no version field
        if not 'version' in f:
            # Set version field to 2
            f['version'] = FileUtils.LAST_FILE_VERSION

            # Enabled field is now directly syncNotesVideo since this field does not contain timestamps anymore
            sync_status = f['syncNotesVideo']['enabled']
            del f['syncNotesVideo']['enabled']

            # We are now storing a dict of videos' URLs and for each, timestamps
            f['currentVideo'] = f['video']
            f['videos'] = {
                f['video']: f['syncNotesVideo']
            }
            del f['video']

            f['syncNotesVideo'] = sync_status

        return f

    @staticmethod
    def flatten_sync(sync):
        """
        Flatten a nested sync

        Input format:
        {
            "http://video1": {
                0: {
                    time: ...,
                    screenshot: ...
                },
                2: {
                    time: ...,
                    screenshot: ...
                },
                ...
            },
            "http://video2": {
                1: {
                    time: ...,
                    screenshot: ...
                },
                3: {
                    time: ...,
                    screenshot: ...
                },
                ...
            }
        }
        Output format:
        {
            0: {
                url: "http://video1"
                time: ...,
                screenshot: ...
            },
            1: {
                url: "http://video2"
                time: ...,
                screenshot: ...
            },
            2: {
                url: "http://video1"
                time: ...,
                screenshot: ...
            },
            3: {
                url: "http://video2"
                time: ...,
                screenshot: ...
            },
            ...
        }
        """
        flat_sync = {}
        for url_video in sync:
            video = sync[url_video]
            for line_sync in video:
                video[line_sync]['url'] = url_video
                flat_sync[int(line_sync)] = video[line_sync]
        return collections.OrderedDict(sorted(flat_sync.items()))

def SibPath(name):
    """Generate a path that is a sibling of this file.

    Args:
      name: Name of sibling file.
    Returns:
      Path to sibling file.
    """
    return os.path.join(os.path.dirname(__file__), name)

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