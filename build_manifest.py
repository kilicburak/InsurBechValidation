import json
import os
import re
import sys
from glob import glob

import pandas


CATEGORIES = [
    ((1, 5), "Car Insurance"),
    ((6, 8), "Home Insurance"),
    ((9, 11), "Medical and Student Insurance"),
    ((12, 15), "Travel Insurance"),
    ((16, 18), "Disability Insurance"),
    ((19, 21), "Pet Insurance"),
    ((22, 25), "Life Insurance"),
]


def natural_key(value):
    return [int(t) if t.isdigit() else t.lower() for t in re.split(r"(\d+)", str(value))]


def doc_number(doc_id):
    nums = re.findall(r"\d+", doc_id)
    return int(nums[0]) if nums else None


def category_for(num):
    for (lo, hi), name in CATEGORIES:
        if num is not None and lo <= num <= hi:
            return name
    return "Other"


def padded_id(doc_id, width):
    return re.sub(r"[-_ ]?(\d+)", lambda m: "-" + m.group(1).zfill(width), doc_id)


def find_pdf(pdf_dir, pid):
    target = (pid + ".pdf").lower()
    for root, _, files in os.walk(pdf_dir):
        for f in files:
            if f.lower() == target:
                return os.path.join(root, f).replace(os.sep, "/")
    return pdf_dir + "/" + pid + ".pdf"


def read_rows(path):
    return pandas.read_excel(path).to_dict(orient="records")


def universe(rows, column):
    return sorted({str(r[column]) for r in rows})


def split_mentions(value):
    return [part.strip() for part in str(value).split(",") if part.strip()]


def options_excluding(values, value):
    return [v for v in values if v != value]


def build_tasks(rows, answer_set, type_set):
    return [
        {
            "id": i,
            "question": r["question"],
            "answer": str(r["answer"]),
            "reasoning": str(r["reason"]),
            "mentions": split_mentions(r["mentions"]),
            "reasoning_type": str(r["reasoning_type"]),
            "answer_options": options_excluding(answer_set, str(r["answer"])),
            "type_options": options_excluding(type_set, str(r["reasoning_type"])),
        }
        for i, r in enumerate(rows)
    ]


def build_manifest(qa_dir, pdf_dir):
    files = sorted(glob(os.path.join(qa_dir, "*.xlsx")))
    all_rows = []
    grouped = []
    for f in files:
        rows = read_rows(f)
        if not rows:
            continue
        doc_id = str(rows[0]["doc"]).strip()
        grouped.append((doc_id, rows))
        all_rows.extend(rows)
    answer_set = universe(all_rows, "answer")
    type_set = universe(all_rows, "reasoning_type")
    numbers = [int(n) for d, _ in grouped for n in re.findall(r"\d+", d)]
    width = max(2, len(str(max(numbers)))) if numbers else 2
    docs = []
    for doc_id, rows in grouped:
        pid = padded_id(doc_id, width)
        num = doc_number(doc_id)
        docs.append({
            "id": pid,
            "title": pid,
            "category": category_for(num),
            "pdf": find_pdf(pdf_dir, pid),
            "count": len(rows),
            "tasks": build_tasks(rows, answer_set, type_set),
        })
    docs.sort(key=lambda d: natural_key(d["id"]))
    order = [name for _, name in CATEGORIES if any(d["category"] == name for d in docs)]
    if any(d["category"] == "Other" for d in docs):
        order.append("Other")
    return {"categories": order, "docs": docs}


qa_dir = sys.argv[1] if len(sys.argv) > 1 else "qa_pairs"
pdf_dir = sys.argv[2] if len(sys.argv) > 2 else "docs"
out = sys.argv[3] if len(sys.argv) > 3 else "manifest.json"
manifest = build_manifest(qa_dir, pdf_dir)
with open(out, "w", encoding="utf-8") as fh:
    json.dump(manifest, fh, ensure_ascii=False, indent=2)
print(out, len(manifest["docs"]), "docs,", len(manifest["categories"]), "categories")