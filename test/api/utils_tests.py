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
        self.assertEqual(v2_f['videos']['test'], {'1': 10.00})

    def test_flatten_sync(self):
        input_sync = {
            'video1': {
                2: {
                    'time': 0,
                    'screenshot': None
                },
                1: {
                    'time': 0,
                    'screenshot': None
                }
            },
            'video2': {
                0: {
                    'time': 0,
                    'screenshot': None
                },
                3: {
                    'time': 0,
                    'screenshot': None
                }
            }
        }

        expected_output = {
            0: {
                'url': 'video2',
                'time': 0,
                'screenshot': None
            },
            1: {
                'url': 'video1',
                'time': 0,
                'screenshot': None
            },
            2: {
                'url': 'video1',
                'time': 0,
                'screenshot': None
            },
            3: {
                'url': 'video2',
                'time': 0,
                'screenshot': None
            }
        }

        expected_output = collections.OrderedDict(sorted(expected_output.items()))
        effective_output = FileUtils.flatten_sync(input_sync)

        self.assertDictEqual(expected_output, effective_output)
