import pandas as pd
import re

df = pd.read_excel("dataset/hadith_arabic_clean_utf8.xlsx")      # غيّر الاسم إذا لزم

pattern = r"^\s*Narrated\s+['\"]?([^:]+):"   # يقتنص اسم الراوي
df["rawi_name_en"] = (
    df["text_en"]        # ⇦ تأكّد أن اسم العمود صحيح
      .fillna("")        # استبدل NaN بسلسلة فارغة
      .str.extract(pattern, expand=False)   # تُرجع العمود مباشرة
)

df = df.rename(columns={"text_ar": "hadith"})
df = df[["hadith_id", "hadith", "rawi_name_en",
         "source", "chapter_no", "hadith_no", "chapter"]]

df.to_csv("hadith_clean.csv", index=False, encoding="utf-8-sig")
print("✅ تم الحفظ إلى hadith_clean.csv")
