from google.appengine.ext import db

__author__ = 'arnaud'

from fixture import DataSet, GoogleDatastoreFixture, NamedDataStyle

class WeeksData(DataSet):
    class week1:
        id = 1
        videos = [
            db.Link('http://d19vezwu8eufl6.cloudfront.net/hollywood/recoded_videos%2FIntro%20to%20Course%202%20%5Be24456e0%5D%20.mp4'),
            db.Link('http://d19vezwu8eufl6.cloudfront.net/hollywood/recoded_videos%2FSilentIntroHolmanE%20%5B44ee2d59%5D%20.mp4'),
            db.Link('http://d19vezwu8eufl6.cloudfront.net/hollywood/recoded_videos%2FStreet%20Angel%20Lecture%20%5B3b8ae1eb%5D%20.mp4'),
            ]

    class week2:
        id = 1
        videos = [
            'http://d19vezwu8eufl6.cloudfront.net/hollywood/recoded_videos%2FIntro%20to%20Course%202%20%5Be24456e0%5D%20.mp4',
            'http://d19vezwu8eufl6.cloudfront.net/hollywood/recoded_videos%2FSilentIntroHolmanE%20%5B44ee2d59%5D%20.mp4',
            'http://d19vezwu8eufl6.cloudfront.net/hollywood/recoded_videos%2FStreet%20Angel%20Lecture%20%5B3b8ae1eb%5D%20.mp4',
            ]

class CourseData(DataSet):
    class language_holywood:
        name = "The Language of Hollywood: Storytelling, Sound, and Color"
        weeks = [WeeksData.week1]