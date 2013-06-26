import json

class FileUtils():
    """
    Transform a VideoNot.es file from a version to another (currently version 2)
    """
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