import sqlite3
conn = sqlite3.connect('/home/orion/Downloads/prima-motor-pos/Backend/pb_data/data.db')
conn.row_factory = sqlite3.Row
c = conn.cursor()

c.execute("SELECT id, text_1, number_1 FROM dropdown WHERE jenis = 'Cashflow Account' LIMIT 2")
accounts = c.fetchall()
for acc in accounts:
    print(dict(acc))
