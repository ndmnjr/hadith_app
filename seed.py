import csv
from sqlalchemy import text
from models import db, Hadith, Rawi
from app import create_app

app = create_app()
with app.app_context():
    db.drop_all()
    db.create_all()
    # Recreate FTS
    db.session.execute(text(
        "CREATE VIRTUAL TABLE IF NOT EXISTS hadith_fts USING fts5(hadith, rawi_name, content='hadith');"
    ))

    with open('hadith_clean.csv', newline='', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            rawi_obj = Rawi.query.filter_by(rawi_name=row['rawi_name_en']).first()
            if not rawi_obj:
                rawi_obj = Rawi(rawi_name=row['rawi_name_en'])
                db.session.add(rawi_obj)
                db.session.flush()

            h = Hadith(
                hadith=row['hadith'],
                rawi_id=rawi_obj.id,
                book=row['source'],
                chapter=row['chapter'],
                number=row['hadith_no']
            )
            db.session.add(h)
            db.session.flush()
            db.session.execute(text(
                "INSERT INTO hadith_fts(rowid, hadith, rawi_name) VALUES (:r,:h_text,:r_name)"
            ), {'r': h.id, 'h_text': h.hadith, 'r_name': rawi_obj.rawi_name})
    db.session.commit()
    print("Database seeded successfully")
