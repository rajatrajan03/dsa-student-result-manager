# Student Result Manager

A Data Structures & Algorithms mini project built around one relatable scenario: managing a class of students and their marks. Every core DSA topic — sorting, searching, stacks, queues, hash maps, recursion, trees, and classic algorithmic patterns — is implemented as a real feature of this system, not an isolated exercise.

No database, no external services. All data lives in memory and resets when you close the program or the page.

## What's in this project

| File | What it is |
|---|---|
| `StudentResultManager.java` | Full backend logic in plain Java (JDK 8+), with a scripted console demo of every feature. |
| `student-result-manager.html` | Interactive, animated front end markup (no build step, no dependencies). |
| `css/style.css` | All styling — glassmorphism theme, layout, animations. |
| `js/script.js` | All application logic — every DSA feature and lab. |
| `sort-snake-lab.html` | Standalone prototype of the connected-chain sorting visual (also integrated into the Learn tab above). |

## How to run

### 1. Java console app

```bash
javac StudentResultManager.java
java StudentResultManager
```

Runs a full scripted demo — adds sample students, then runs every sorting algorithm, both searches, all patterns, and prints the results to the console.

### 2. Interactive visualizer

```bash
python -m http.server 5500
```

Then open **http://localhost:5500/student-result-manager.html** in your browser.

Use the tab bar to explore each group of features, or press **"▶ Guided Tour"** next to the title to have the whole app demo itself automatically.

- **Overview** — add/delete students, undo, search (with Trie-powered autocomplete), kth-highest, live stats, ranked list, Save/Load/Clear via local storage.
- **Sorting** — Bubble, Selection, Insertion, and Merge sort, each animated step by step, plus a side-by-side Algorithm Race.
- **Searching** — animated Linear search and Binary search, side by side.
- **Structures** — Undo/Redo stack pair, Recent-additions Queue, Grade-distribution HashMap, Duplicate-marks HashSet, Binary Search Tree, Priority Queue / Heap.
- **Patterns** — Two Sum (hash map pattern), two-pointer Reverse, Sliding Window, Prefix Sum, Recursion (call stack).
- **Learn** — a catalog of 21 standalone practice labs, each with its own random data independent of your class list, organized into 6 categories:
  - **Linear Data Structures** — Stack & Queue, Linked List, Circular Queue / Deque, Matrix traversal
  - **Non-Linear Data Structures** — Trie Tree, AVL Tree, Hashing, LRU Cache, Union-Find (Disjoint Set)
  - **Searching & Sorting** — Sorting (Quick/Heap/Counting), Searching, Counting Sort
  - **Graph** — BFS/DFS, Minimum Spanning Tree (Prim's & Kruskal's), Topological Sort (DFS-based & Kahn's)
  - **Paths** — Shortest Paths (Dijkstra, Bellman-Ford, Floyd-Warshall)
  - **Algorithm Techniques** — Recursion, Dynamic Programming (Fibonacci, 0/1 Knapsack, LCS), N-Queens (backtracking), Huffman Coding (greedy), Bit Manipulation

A shared **animation speed** control (Slowest–Fastest) is available on the Sorting, Searching, and Structures tabs, and stays in sync across all three. Press **"▶ Guided Tour"** to have the whole app demo itself automatically.

## DSA concepts covered

**Sorting:** built-in sort, Bubble Sort, Selection Sort, Insertion Sort, Merge Sort, Quick Sort, Heap Sort, Counting Sort
**Searching:** Linear Search, Binary Search
**Data structures:** Stack, Queue, HashMap, HashSet, Binary Search Tree, AVL Tree, Trie, Linked List, Circular Queue / Deque, Priority Queue / Heap, LRU Cache
**Graph algorithms:** BFS, DFS, Dijkstra's shortest path, Bellman-Ford, Floyd-Warshall, Prim's MST, Kruskal's MST, Topological Sort (DFS & Kahn's), Union-Find
**Dynamic programming:** Fibonacci (memoized vs. plain recursion), 0/1 Knapsack, Longest Common Subsequence
**Backtracking & greedy:** N-Queens, Huffman Coding
**Patterns:** Two Sum, two-pointer reversal, sliding window, prefix sum, recursion, bit manipulation
**Supporting logic:** grading (conditional logic), kth-highest, delete

## Running it in VS Code

1. **Install prerequisites** (one-time):
   - [JDK 8 or newer](https://adoptium.net/) — check with `java -version` in a terminal.
   - [Python 3](https://www.python.org/downloads/) (only used to serve the HTML file locally) — check with `python --version`.
   - VS Code extension **Java Extension Pack** (by Microsoft) if you want to run the Java file with a click instead of the terminal.

2. **Open the project folder** in VS Code: `File > Open Folder…` and select this repo's folder.

3. **Run the Java console app:**
   - Open `StudentResultManager.java`.
   - With the Java Extension Pack installed, click the **▶ Run** button above the `main` method — VS Code compiles and runs it in the integrated terminal.
   - Or, without the extension, open a VS Code terminal (`` Ctrl+` ``) and run:
     ```bash
     javac StudentResultManager.java
     java StudentResultManager
     ```

4. **Run the interactive web app:**
   - Open a VS Code terminal (`` Ctrl+` ``) in the project folder and run:
     ```bash
     python -m http.server 5500
     ```
   - Open **http://localhost:5500/student-result-manager.html** in your browser.
   - (Optional) Install the **Live Server** extension in VS Code and click "Go Live" instead — it does the same job without a manual terminal command.

## Notes

- Works entirely offline once the files are on disk — the visualizer needs only a static file server (no backend, no database).
- Best viewed with the browser tab focused; heavily backgrounded tabs can pause JavaScript timers mid-animation (normal browser behavior) — just refocus the tab to resume.
- Both light and dark OS themes are supported automatically.
