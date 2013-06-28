import collections
import unittest
from utils import FileUtils

__author__ = 'arnaud'


class TestFileUtils(unittest.TestCase):
    def test_get_empty_file(self):
        returned_f = FileUtils.get_empty_file()

        self.assertEqual(returned_f, {
            'version': FileUtils.LAST_FILE_VERSION,
            'content': '',
            'currentVideo': None,
            'videos': {},
            'syncNotesVideo': True
        })

    def test_transformations_v1_to_v2(self):
        v1_f = {
            'content': '',
            'video': 'test',
            'syncNotesVideo': {
                'enabled': True,
                '1': 10.00
            }
        }

        v2_f = FileUtils.transformation_v1_to_v2(v1_f)

        self.assertEqual(v2_f['version'], 2)
        self.assertNotIn('video', v2_f)
        self.assertIsNotNone(v2_f['videos']['test'])
        self.assertEqual(v2_f['videos']['test']['1'], {'time':10.00})

    def test_flatten_sync(self):
        input_sync = {
            'video1': {
                2: {
                    'time': 0,
                },
                1: {
                    'time': 0,
                }
            },
            'video2': {
                0: {
                    'time': 0,
                },
                3: {
                    'time': 0,
                }
            }
        }

        expected_output = {
            0: {
                'url': 'video2',
                'time': 0,
            },
            1: {
                'url': 'video1',
                'time': 0,
            },
            2: {
                'url': 'video1',
                'time': 0,
            },
            3: {
                'url': 'video2',
                'time': 0,
            }
        }

        expected_output = collections.OrderedDict(sorted(expected_output.items()))
        effective_output = FileUtils.flatten_sync(input_sync)

        self.assertDictEqual(expected_output, effective_output)

    def test_to_enml_with_screenshots(self):
        file = {
            'id': 'test',
            'content': 'test' + '\n' + '<{0}>'.format(FileUtils.SNAPSHOT_KEY),
            'videos': {
                'video1': {
                    2: {
                        'time': 0,
                        'snapshot': None
                    },
                    1: {
                        'time': 0,
                        'snapshot': 'snapshot'
                    }
                },
                'video2': {
                    0: {
                        'time': 0,
                        'snapshot': None
                    },
                    3: {
                        'time': 0,
                        'snapshot': None
                    }
                }
            }
        }

        base_url = 'http://test.videonot.es/edit/' + file['id']

        expected_enml = [
            '<a href="{0}?l=1">+</a> test'.format(base_url),
            '<br></br>',
            '<br></br>',
            '<img src="{0}"></img>'.format('snapshot'),
            '<br></br>',
            '<a href="{0}">{0}</a>'.format('video1'),
            '<br></br><br></br>'
        ]

        content_enml = FileUtils.to_ENML(file, base_url)
        self.assertEqual(expected_enml, content_enml)

    def test_to_enml_without_screenshots(self):
        file = {
            'id': 'test',
            'content': 'test' + '\n' + 'test2',
            'videos': {
                'video1': {
                    2: {
                        'time': 0,
                        'snapshot': None
                    },
                    1: {
                        'time': 0,
                        'snapshot': None
                    }
                },
                'video2': {
                    0: {
                        'time': 0,
                        'snapshot': None
                    },
                    3: {
                        'time': 0,
                        'snapshot': None
                    }
                }
            }
        }

        base_url = 'http://test.videonot.es/edit/' + file['id']

        expected_enml = [
            '<a href="{0}?l=1">+</a> test'.format(base_url),
            '<br></br>',
            '<a href="{0}?l=2">+</a> test2'.format(base_url),
            '<br></br>',
        ]

        content_enml = FileUtils.to_ENML(file, base_url)
        self.assertEqual(expected_enml, content_enml)
