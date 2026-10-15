"""
generate_dataset.py - Synthetic Dataset Generator for Distributed Systems Experiments
Generates 1,000+ realistic academic library book records with deterministic reproducibility.
"""

import json
import random

SEED = 42
random.seed(SEED)

CATEGORIES = [
    "Computer Science",
    "Electrical Engineering",
    "Mechanical Engineering",
    "Civil Engineering",
    "Information Technology",
    "Mathematics",
    "Physics",
    "Management Studies"
]

AUTHORS = [
    "Andrew S. Tanenbaum", "Martin Kleppmann", "Abraham Silberschatz", "Donald E. Knuth",
    "Thomas H. Cormen", "Stuart Russell", "Peter Norvig", "Ian Goodfellow",
    "David Patterson", "John L. Hennessy", "Maurice Herlihy", "Nir Shavit",
    "Bjarne Stroustrup", "Guido van Rossum", "James Gosling", "Robert C. Martin",
    "Eric Evans", "Martin Fowler", "Leslie Lamport", "Nancy Lynch",
    "Christian Cachin", "Rachid Guerraoui", "George Coulouris", "Jean Dollimore",
    "Michael J. Quinn", "David A. Huffman", "Claude Shannon", "Alan Turing"
]

TOPICS = [
    "Distributed Systems: Principles and Paradigms",
    "Designing Data-Intensive Applications",
    "Operating System Concepts and Design",
    "The Art of Computer Programming",
    "Introduction to Algorithms",
    "Artificial Intelligence: A Modern Approach",
    "Deep Learning and Neural Architectures",
    "Computer Architecture: A Quantitative Approach",
    "The Art of Multiprocessor Programming",
    "Clean Code: A Handbook of Agile Craftsmanship",
    "Domain-Driven Design: Tackling Complexity",
    "Patterns of Enterprise Application Architecture",
    "Principles of Distributed Database Systems",
    "Database System Implementation",
    "Compilers: Principles, Techniques, and Tools",
    "Computer Networks and Internet Protocols",
    "Cloud Computing and Microservices Architecture",
    "Cryptography and Network Security",
    "High Performance Distributed Computing",
    "Quantum Computing: Principles and Algorithms"
]

def generate_books(count=1000):
    books = []
    for i in range(1, count + 1):
        cat = CATEGORIES[i % len(CATEGORIES)]
        author = random.choice(AUTHORS)
        topic = random.choice(TOPICS)
        edition = random.choice(["1st Edition", "2nd Edition", "3rd Edition", "Global Edition", "Revised Edition"])
        title = f"{topic} ({edition}) Vol. {((i - 1) % 5) + 1}"
        copies = random.randint(2, 8)

        book = {
            "bookId": f"BK-{i:05d}",
            "title": title,
            "author": author,
            "category": cat,
            "totalCopies": copies,
            "availableCopies": copies
        }
        books.append(book)
    return books

def save_to_file(filepath="experiments/synthetic_books_1000.json", count=1000):
    data = generate_books(count)
    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)
    print(f"[+] Successfully generated and saved {len(data)} synthetic books to {filepath}")
    return data

if __name__ == "__main__":
    save_to_file()
