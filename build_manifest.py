import json
import os
import re
import sys
from glob import glob

import pandas


def natural_key(value):
    return [int(t) if t.isdigit() else t.lower() for t in re.split(r"(\d+)", str(value))]


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
    docs = []
    for doc_id, rows in grouped:
        pdf_name = doc_id + ".pdf"
        docs.append({
            "id": doc_id,
            "title": doc_id,
            "pdf": pdf_dir + "/" + pdf_name,
            "count": len(rows),
            "tasks": build_tasks(rows, answer_set, type_set),
        })
    docs.sort(key=lambda d: natural_key(d["id"]))
    return {"docs": docs}


qa_dir = sys.argv[1] if len(sys.argv) > 1 else "qa_pairs"
pdf_dir = sys.argv[2] if len(sys.argv) > 2 else "docs"
out = sys.argv[3] if len(sys.argv) > 3 else "manifest.json"
manifest = build_manifest(qa_dir, pdf_dir)
with open(out, "w", encoding="utf-8") as fh:
    json.dump(manifest, fh, ensure_ascii=False, indent=2)
print(out, len(manifest["docs"]), "docs")