from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()

class Rawi(db.Model):
    __tablename__ = 'rawi'
    id = db.Column(db.Integer, primary_key=True)
    rawi_name = db.Column(db.String, nullable=False)
    other_names = db.Column(db.String)

class Hadith(db.Model):
    __tablename__ = 'hadith'
    id = db.Column(db.Integer, primary_key=True)
    hadith = db.Column(db.Text, nullable=False)
    rawi_id = db.Column(db.Integer, db.ForeignKey('rawi.id'))
    book = db.Column(db.String, nullable=False)
    chapter = db.Column(db.String)
    number = db.Column(db.String)

    rawi = db.relationship('Rawi')

class SubHadith(db.Model):
    __tablename__ = 'sub_hadith'
    id = db.Column(db.Integer, primary_key=True)
    hadith_id = db.Column(db.Integer, db.ForeignKey('hadith.id'))
    hadith = db.Column(db.Text, nullable=False)
    rawi_id = db.Column(db.Integer, db.ForeignKey('rawi.id'))
    book = db.Column(db.String, nullable=False)
    chapter = db.Column(db.String)
    number = db.Column(db.String)
    place = db.Column(db.String)

    parent = db.relationship('Hadith')
    rawi = db.relationship('Rawi')
