from flask import Flask, render_template, request, send_file, redirect, url_for
from sqlalchemy import text
import io, pandas as pd

from config import Config
from models import db, Hadith, Rawi

def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)
    db.init_app(app)

    # ⬇️ التهيئة مرة واحدة عند إنشاء التطبيق
    with app.app_context():
        db.create_all()
        # أنشئ جدول FTS5 للبحث إن كنت على SQLite
        if app.config["SQLALCHEMY_DATABASE_URI"].startswith("sqlite"):
            db.session.execute(text(
                "CREATE VIRTUAL TABLE IF NOT EXISTS hadith_fts "
                "USING fts5(hadith, rawi_name, content='hadith');"
            ))
            db.session.commit()

    """@app.before_first_request
    def setup():
        db.create_all()
        # Create FTS5 virtual table for fast search (SQLite only)
        db.session.execute(text(
            "CREATE VIRTUAL TABLE IF NOT EXISTS hadith_fts USING fts5(hadith, rawi_name, content='hadith');"
        ))
        db.session.commit()"""

    def fts_search(term: str):
        rows = db.session.execute(
            text("SELECT rowid FROM hadith_fts WHERE hadith_fts MATCH :t"), {'t': term}
        ).fetchall()
        return [r[0] for r in rows]

    @app.route('/', methods=['GET', 'POST'])
    def index():
        filters = {}
        query = Hadith.query

        if request.method == 'POST':
            q = request.form.get('q', '').strip()
            if q:
                ids = fts_search(q)
                query = query.filter(Hadith.id.in_(ids))
                filters['q'] = q

            book = request.form.get('book', '').strip()
            if book:
                query = query.filter(Hadith.book == book)
                filters['book'] = book

            chapter = request.form.get('chapter', '').strip()
            if chapter:
                query = query.filter(Hadith.chapter == chapter)
                filters['chapter'] = chapter

            rawi_name = request.form.get('rawi', '').strip()
            if rawi_name:
                query = query.join(Rawi).filter(Rawi.rawi_name.contains(rawi_name))
                filters['rawi'] = rawi_name

            number = request.form.get('number', '').strip()
            if number:
                query = query.filter(Hadith.number == number)
                filters['number'] = number

        results = query.limit(200).all()
        return render_template('index.html', results=results, filters=filters)

    @app.route('/reset')
    def reset():
        return redirect(url_for('index'))

    @app.route('/export')
    def export_csv():
        q = request.args.get('q', '').strip()
        query = Hadith.query
        if q:
            ids = fts_search(q)
            query = query.filter(Hadith.id.in_(ids))
        data = [{
            'id': h.id,
            'hadith': h.hadith,
            'rawi': h.rawi.rawi_name if h.rawi else '',
            'book': h.book,
            'chapter': h.chapter,
            'number': h.number
        } for h in query.all()]
        df = pd.DataFrame(data)
        buf = io.StringIO()
        df.to_csv(buf, index=False)
        mem = io.BytesIO(buf.getvalue().encode('utf-8'))
        mem.seek(0)
        return send_file(mem, mimetype='text/csv', as_attachment=True, download_name='search_results.csv')

    return app

if __name__ == "__main__":
    create_app().run(debug=True)
