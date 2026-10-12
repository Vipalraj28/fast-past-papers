"""
Vipal Raj Papers - paper organizer

FOLDER MAP (kahan kya rakhna hai)
---------------------------------
vipal-papers/
  inbox/                  <- YAHAN saare naye papers daal do (kisi bhi naam se)
  papers/
    COAL/
      Mid 1/              <- COAL ke Mid 1 papers
      Mid 2/              <- COAL ke Mid 2 papers
      Final/              <- COAL ke Final papers
      Quiz/               <- COAL ke Quiz
      Assignment/         <- COAL ki Assignments
      Other/              <- baqi sab
    Programming Fundamentals/ ... (har subject ke andar yehi 6 folders)
    Programming Lab/      <- sirf 2 folders: Mid aur Final
    DSA Lab/              <- sirf 2 folders: Mid aur Final
    OOP Lab/              <- sirf 2 folders: Mid aur Final
    COAL Lab/             <- sirf 2 folders: Mid aur Final
  assets/css/style.css    <- design (colors, hover, animation)
  assets/js/app.js        <- website ki functionality
  index.html              <- website ka page
  papers.json, papers.js  <- ye script khud banati hai, haath se mat chhedo

KAISE USE KARNA HAI
-------------------
TARIKA 1 (aasan): file inbox/ mein daalo, naam aisa rakho:
      "COAL Mid 2 2023 solved.pdf"
      script naam parh kar usse papers/COAL/Mid 2/ mein rakh deti hai.
TARIKA 2: file seedha sahi folder mein rakho, jaise papers/COAL/Mid 2/.
      (is surat mein exam type folder se pata chalta hai, naam kuch bhi ho)

Dono tarikon ke baad chalao:   python organize.py
Site dekhne ke liye:           index.html par double-click karo (ya python organize.py --serve)

NAYA SUBJECT: neeche SUBJECTS mein ek line add karo, script khud folders bana degi.
FILE KE NAAM MEIN: year (2023) aur "solved" likhoge to website ke filters kaam karenge.
"""
import functools
import http.server
import json
import re
import shutil
import socketserver
import sys
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent
INBOX, PAPERS = ROOT / "inbox", ROOT / "papers"
EXTS = {".pdf", ".png", ".jpg", ".jpeg", ".webp", ".docx", ".pptx"}

# Subject folder name -> words that may appear in a file name
SUBJECTS = {
    "COAL": ["coal", "computer organization", "assembly"],
    "Programming Fundamentals": ["pf", "programming fundamentals", "prog fund"],
    "OOP": ["oop", "object oriented"],
    "Data Structures": ["dsa", "ds", "data structures"],
    "Database Systems": ["dbms", "db", "database"],
    "Calculus": ["calculus", "calc", "cal"],
    "Discrete Structures": ["discrete", "dm"],
    "Linear Algebra": ["linear algebra", "la"],
    "Operating Systems": ["operating system", "os"],
    "Computer Networks": ["networks", "cn"],
    "Digital Logic Design": ["dld", "digital logic"],
    "Probability & Statistics": ["probability", "statistics", "prob"],
    "Software Engineering": ["software engineering", "sda", "se"],
    "Artificial Intelligence": ["artificial intelligence", "ai"],
    "Theory of Automata": ["automata", "toa"],
    "Analysis of Algorithms": ["algorithms", "algo", "daa"],
    "Compiler Construction": ["compiler construction", "compiler", "cc"],
    "Sociology": ["sociology", "socio"],
    "Programming Lab": ["programming lab", "pf lab", "plab"],
    "DSA Lab": ["dsa lab", "ds lab", "data structures lab"],
    "OOP Lab": ["oop lab", "object oriented lab", "object oriented programming lab"],
    "COAL Lab": ["coal lab", "computer organization and assembly language lab", "computer organization lab", "assembly language lab"],
}
UNSORTED = "Unsorted"

# Har subject folder ke andar ye 6 folders bante hain.
# Website ke "Exam type" dropdown ke naam bhi yehi hain.
TYPE_FOLDERS = ["Mid 1", "Mid 2", "Final", "Quiz", "Assignment", "Other"]

# Jin subjects mein sirf kuch hi exam hote hain wo yahan likho.
# Jaise Programming Lab mein sirf ek Mid aur ek Final hota hai.
# Naya lab add karna ho to yahan ek line aur likh do.
SUBJECT_TYPES = {
    "Programming Lab": ["Mid", "Final"],
    "DSA Lab": ["Mid", "Final"],
    "OOP Lab": ["Mid", "Final"],
    "COAL Lab": ["Mid", "Final"],
}
ALL_TYPES = TYPE_FOLDERS + ["Mid"]


def types_for(subject):
    """Is subject ke andar kaun kaun se exam folders banenge."""
    return SUBJECT_TYPES.get(subject, TYPE_FOLDERS)


def make_folders():
    """papers/<Subject>/<Exam type>/ sab folders bana do (dobara chalane se kuch nahi bigarta)."""
    for subject in SUBJECTS:
        for t in types_for(subject):
            folder = PAPERS / subject / t
            folder.mkdir(parents=True, exist_ok=True)
            hint = folder / "PUT_PAPERS_HERE.txt"
            if not hint.exists():
                hint.write_text(f"{subject} - {t}: apne papers (PDF/images) is folder mein rakho.\n", encoding="utf-8")


def norm(name: str) -> str:
    return re.sub(r"[\s_\-.()]+", " ", name.lower()).strip()


def find_subject(stem: str) -> str:
    text = norm(stem)
    words = set(text.split())
    best, best_len = UNSORTED, 0
    for subject, keys in SUBJECTS.items():
        for k in keys:
            hit = k in words if " " not in k and len(k) <= 3 else re.search(rf"\b{re.escape(k)}", text)
            if hit and len(k) > best_len:
                best, best_len = subject, len(k)
    return best


def find_type(stem: str, subject=None) -> str:
    t = _guess_type(stem)
    allowed = SUBJECT_TYPES.get(subject)
    if allowed:  # jaise Programming Lab: Mid 1 / Mid 2 sab 'Mid' ban jata hai
        if t in ("Mid 1", "Mid 2") and "Mid" in allowed:
            t = "Mid"
        if t not in allowed:
            t = "Other"
    return t


def _guess_type(stem: str) -> str:
    t = norm(stem)
    if re.search(r"\b(final|terminal)", t):
        return "Final"
    if re.search(r"\b(mid(term)?|m|sessional|s)\s?2\b", t):
        return "Mid 2"
    if re.search(r"\b(mid(term)?|m|sessional|s)\s?1\b|\bmid(term)?\b|\bsessional\b", t):
        return "Mid 1"
    if "quiz" in t:
        return "Quiz"
    if "assign" in t:
        return "Assignment"
    return "Other"


def find_year(stem: str):
    m = re.search(r"(20\d\d)", stem)
    return int(m.group(1)) if m else None


def is_solved(stem: str) -> bool:
    return bool(re.search(r"\b(solved|sol|key)\b", norm(stem)))


def sort_inbox():
    INBOX.mkdir(exist_ok=True)
    moved = 0
    # inbox ki files + Unsorted mein pehle se padi files (agar ab un ka subject pehchana jaye)
    candidates = sorted(INBOX.iterdir())
    unsorted_dir = PAPERS / UNSORTED
    if unsorted_dir.exists():
        candidates += sorted(unsorted_dir.rglob("*"))
    for f in candidates:
        if not f.is_file() or f.name.startswith("."):
            continue
        from_unsorted = unsorted_dir in f.parents
        if f.suffix.lower() not in EXTS:
            if not from_unsorted:
                print(f"  SKIP  {f.name}  (ye file type supported nahi. PDF ya image chahiye)")
            continue
        subject = find_subject(f.stem)
        if from_unsorted and subject == UNSORTED:
            continue  # abhi bhi pehchana nahi gaya, wahin rehne do
        dest_dir = PAPERS / subject / find_type(f.stem, subject)
        dest_dir.mkdir(parents=True, exist_ok=True)
        dest = dest_dir / f.name
        n = 1
        while dest.exists():
            dest = dest_dir / f"{f.stem}_{n}{f.suffix}"
            n += 1
        shutil.move(str(f), str(dest))
        print(f"  OK    {f.name}  ->  papers/{dest_dir.relative_to(PAPERS)}/")
        if subject == UNSORTED:
            print("        (subject pehchana nahi gaya. Naam mein subject likho, ya file seedha sahi folder mein rakho)")
        moved += 1
    return moved


def build_index():
    PAPERS.mkdir(exist_ok=True)
    items = []
    for f in sorted(PAPERS.rglob("*")):
        if not f.is_file() or f.suffix.lower() not in EXTS:
            continue
        rel = f.relative_to(PAPERS)
        subject = rel.parts[0] if len(rel.parts) > 1 else UNSORTED
        # papers/COAL/Mid 2/file.pdf -> type folder se ("Mid 2"), warna file ke naam se
        folder_type = rel.parts[1] if len(rel.parts) > 2 and rel.parts[1] in ALL_TYPES else None
        items.append({
            "subject": subject,
            "title": f.stem.replace("_", " ").replace("-", " ").strip(),
            "file": "papers/" + rel.as_posix(),
            "year": find_year(f.stem),
            "type": folder_type or find_type(f.stem, subject),
            "solved": is_solved(f.stem),
            "size": f.stat().st_size,
            "added": int(f.stat().st_mtime),
        })
    # Saare subject folders (khali bhi), taake website pe subject buttons hamesha dikhein
    subjects = sorted(d.name for d in PAPERS.iterdir() if d.is_dir() and d.name != UNSORTED)
    data = {"generated": datetime.now().isoformat(timespec="seconds"), "subjects": subjects, "papers": items}
    (ROOT / "papers.json").write_text(json.dumps(data, indent=1), encoding="utf-8")
    # papers.js: wahi data, lekin aisi shakl mein jo index.html seedha double-click se bhi parh sake
    (ROOT / "papers.js").write_text("window.PAPERS_DATA = " + json.dumps(data) + ";\n", encoding="utf-8")
    return len(items)


def serve(port=8000):
    handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(ROOT))
    with socketserver.TCPServer(("", port), handler) as srv:
        print(f"Open http://localhost:{port}  (Ctrl+C to stop)")
        srv.serve_forever()


if __name__ == "__main__":
    make_folders()
    print("Sorting inbox...")
    moved = sort_inbox()
    total = build_index()
    print(f"Done. Moved {moved} file(s). {total} paper(s) in papers.json.")
    if "--serve" in sys.argv:
        serve()