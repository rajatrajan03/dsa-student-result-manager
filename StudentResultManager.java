import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedList;
import java.util.Map;
import java.util.Queue;
import java.util.Set;
import java.util.Stack;

/*
 * Student Result Manager
 * -----------------------
 * Stores students (name + marks) in memory (an ArrayList — no database).
 * Demonstrates:
 *   - Sorting            (marks ke hisaab se highest to lowest)  O(n log n)
 *   - Bubble Sort        (manual step-by-step sort, shows swaps) O(n^2)
 *   - Selection Sort     (find min each pass, one swap per pass) O(n^2)
 *   - Insertion Sort     (shift into place, like sorting cards)  O(n^2)
 *   - Merge Sort         (divide and conquer, split + merge)     O(n log n)
 *   - Linear Search      (naam se student dhoondhna)             O(n)
 *   - Binary Search      (marks se dhoondhna, sorted array pe)   O(log n)
 *   - Delete             (array se remove karna)                 O(n)
 *   - Undo (Stack, LIFO) (last action wapas lena)                O(1)
 *   - Recent Additions (Queue, FIFO) (last N adds, oldest first) O(1)
 *   - Kth Highest        (Nth topper nikalna)                    O(n log n)
 *   - Grading            (marks -> A/B/C/D/F, conditional logic) O(1)
 *   - Grade Distribution (HashMap frequency count)               O(n)
 *   - Pair With Target Sum (HashMap lookup, "two sum" pattern)   O(n)
 *   - Reverse List       (two-pointer swap from both ends)       O(n)
 *   - Recursive Sum      (recursion / call stack)                O(n)
 *   - Duplicate Marks    (HashSet membership check)               O(n)
 *   - Sliding Window     (max-average window of k students)      O(n)
 *   - Prefix Sum         (cumulative running average)             O(n)
 *   - Marks Histogram    (bucketed frequency count)               O(n)
 *   - Binary Search Tree (insert + inorder traversal)         O(n log n) avg
 *
 * No external data needed — sab data run-time par add hota hai.
 */
public class StudentResultManager {

    static class Student {
        String name;
        int marks;
        Student(String name, int marks) {
            this.name = name;
            this.marks = marks;
        }
    }

    // action types used for undo
    private interface Action { void undo(); }

    private static final int RECENT_LIMIT = 5;

    private final ArrayList<Student> students = new ArrayList<>();
    private final Stack<Action> history = new Stack<>();           // LIFO undo stack
    private final Queue<String> recentAdditions = new LinkedList<>(); // FIFO — oldest add leaves first

    public void addStudent(String name, int marks) {
        Student s = new Student(name, marks);
        students.add(s);
        history.push(() -> students.remove(s));

        recentAdditions.offer(name);       // enqueue at the back
        if (recentAdditions.size() > RECENT_LIMIT) {
            recentAdditions.poll();        // dequeue from the front — oldest forgotten first
        }
        System.out.println("Added: " + name + " -> " + marks + " marks");
    }

    // Prints the queue front-to-back (oldest still-tracked addition first)
    public void showRecentAdditions() {
        System.out.println("\n--- Recent Additions (Queue, oldest first) ---");
        System.out.println(recentAdditions);
    }

    // Removes a student by name (linear scan), pushes an undo action
    public boolean deleteStudent(String name) {
        for (int i = 0; i < students.size(); i++) {
            Student s = students.get(i);
            if (s.name.equalsIgnoreCase(name)) {
                students.remove(i);
                int insertAt = i;
                history.push(() -> students.add(insertAt, s));
                System.out.println("Deleted: " + s.name);
                return true;
            }
        }
        System.out.println(name + " not found, nothing deleted.");
        return false;
    }

    // Pops the last action off the stack and reverses it (LIFO)
    public void undo() {
        if (history.isEmpty()) {
            System.out.println("Nothing to undo.");
            return;
        }
        history.pop().undo();
        System.out.println("Undo successful — reverted last action.");
    }

    // Sorts by marks, highest first (O(n log n))
    public void showRanked() {
        ArrayList<Student> sorted = new ArrayList<>(students);
        sorted.sort(Comparator.comparingInt((Student s) -> s.marks).reversed());

        System.out.println("\n--- Ranked List (High to Low) ---");
        int rank = 1;
        for (Student s : sorted) {
            System.out.println(rank + ". " + s.name + " - " + s.marks + " marks (Grade " + getGrade(s.marks) + ")");
            rank++;
        }
    }

    // Linear search by name (O(n))
    public void search(String name) {
        for (Student s : students) {
            if (s.name.equalsIgnoreCase(name)) {
                System.out.println("Found: " + s.name + " -> " + s.marks + " marks");
                return;
            }
        }
        System.out.println(name + " not found.");
    }

    // Binary search for an exact marks value. Array MUST be sorted first (ascending).
    // Classic divide-and-conquer: O(log n) instead of O(n).
    public void binarySearchByMarks(int targetMarks) {
        ArrayList<Student> sorted = new ArrayList<>(students);
        sorted.sort(Comparator.comparingInt(s -> s.marks)); // ascending, required for binary search

        int low = 0, high = sorted.size() - 1, steps = 0;
        while (low <= high) {
            steps++;
            int mid = (low + high) / 2;
            int midMarks = sorted.get(mid).marks;
            System.out.println("  step " + steps + ": checking middle (index " + mid + ", marks=" + midMarks + ")");
            if (midMarks == targetMarks) {
                System.out.println("Found " + sorted.get(mid).name + " with " + targetMarks + " marks in " + steps + " step(s).");
                return;
            } else if (midMarks < targetMarks) {
                low = mid + 1;
            } else {
                high = mid - 1;
            }
        }
        System.out.println("No student with exactly " + targetMarks + " marks (" + steps + " step(s) checked).");
    }

    // Bubble Sort: repeatedly swaps adjacent out-of-order pairs until the array is sorted.
    // Doesn't rely on Java's built-in sort — shows the actual O(n^2) algorithm, comparison by comparison.
    public void bubbleSortByMarks() {
        ArrayList<Student> arr = new ArrayList<>(students);
        int n = arr.size();
        int comparisons = 0, swaps = 0;

        System.out.println("\n--- Bubble Sort (ascending by marks) ---");
        for (int pass = 0; pass < n - 1; pass++) {
            boolean swappedThisPass = false;
            for (int i = 0; i < n - pass - 1; i++) {
                comparisons++;
                if (arr.get(i).marks > arr.get(i + 1).marks) {
                    Collections.swap(arr, i, i + 1);
                    swaps++;
                    swappedThisPass = true;
                }
            }
            if (!swappedThisPass) break; // already sorted, stop early
        }

        for (Student s : arr) System.out.println("  " + s.name + " - " + s.marks);
        System.out.println("Comparisons: " + comparisons + ", Swaps: " + swaps);
    }

    // Selection Sort: each pass finds the minimum of the unsorted part and swaps it
    // into place. Unlike bubble sort, only ONE swap happens per pass. O(n^2).
    public void selectionSortByMarks() {
        ArrayList<Student> arr = new ArrayList<>(students);
        int n = arr.size();
        int comparisons = 0, swaps = 0;

        System.out.println("\n--- Selection Sort (ascending by marks) ---");
        for (int i = 0; i < n - 1; i++) {
            int minIdx = i;
            for (int j = i + 1; j < n; j++) {
                comparisons++;
                if (arr.get(j).marks < arr.get(minIdx).marks) minIdx = j;
            }
            if (minIdx != i) {
                Collections.swap(arr, i, minIdx);
                swaps++;
            }
        }
        for (Student s : arr) System.out.println("  " + s.name + " - " + s.marks);
        System.out.println("Comparisons: " + comparisons + ", Swaps: " + swaps);
    }

    // Insertion Sort: builds the sorted portion one element at a time, shifting
    // larger elements right to make room — like sorting playing cards in your hand. O(n^2).
    public void insertionSortByMarks() {
        ArrayList<Student> arr = new ArrayList<>(students);
        int n = arr.size();
        int comparisons = 0, shifts = 0;

        System.out.println("\n--- Insertion Sort (ascending by marks) ---");
        for (int i = 1; i < n; i++) {
            Student key = arr.get(i);
            int j = i - 1;
            while (j >= 0) {
                comparisons++;
                if (arr.get(j).marks > key.marks) {
                    arr.set(j + 1, arr.get(j));
                    shifts++;
                    j--;
                } else {
                    break;
                }
            }
            arr.set(j + 1, key);
        }
        for (Student s : arr) System.out.println("  " + s.name + " - " + s.marks);
        System.out.println("Comparisons: " + comparisons + ", Shifts: " + shifts);
    }

    // Merge Sort: divide-and-conquer. Splits the list in half recursively until
    // pieces of size 1 remain, then merges pairs back together in sorted order. O(n log n).
    public void mergeSortByMarks() {
        ArrayList<Student> arr = new ArrayList<>(students);
        System.out.println("\n--- Merge Sort (ascending by marks) ---");
        ArrayList<Student> sorted = mergeSortHelper(arr, 0);
        for (Student s : sorted) System.out.println("  " + s.name + " - " + s.marks);
    }

    private ArrayList<Student> mergeSortHelper(ArrayList<Student> arr, int depth) {
        if (arr.size() <= 1) return arr;
        int mid = arr.size() / 2;
        ArrayList<Student> left = mergeSortHelper(new ArrayList<>(arr.subList(0, mid)), depth + 1);
        ArrayList<Student> right = mergeSortHelper(new ArrayList<>(arr.subList(mid, arr.size())), depth + 1);
        return merge(left, right);
    }

    private ArrayList<Student> merge(ArrayList<Student> left, ArrayList<Student> right) {
        ArrayList<Student> result = new ArrayList<>();
        int i = 0, j = 0;
        while (i < left.size() && j < right.size()) {
            if (left.get(i).marks <= right.get(j).marks) result.add(left.get(i++));
            else result.add(right.get(j++));
        }
        while (i < left.size()) result.add(left.get(i++));
        while (j < right.size()) result.add(right.get(j++));
        return result;
    }

    // Recursion: sums all marks by calling itself on a smaller slice each time,
    // instead of a loop. Demonstrates the call stack building up then unwinding.
    public int recursiveSum(int index) {
        if (index >= students.size()) return 0; // base case
        return students.get(index).marks + recursiveSum(index + 1); // recursive case
    }

    public void showRecursiveSum() {
        int total = recursiveSum(0);
        System.out.println("\n--- Recursive Sum of Marks ---");
        System.out.println("Total (via recursion): " + total);
    }

    // Finds duplicate marks using a HashSet — O(n) instead of comparing every pair.
    public void findDuplicateMarks() {
        Set<Integer> seen = new HashSet<>();
        Set<Integer> duplicates = new HashSet<>();
        for (Student s : students) {
            if (!seen.add(s.marks)) duplicates.add(s.marks); // add() returns false if already present
        }
        System.out.println("\n--- Duplicate Marks (HashSet) ---");
        if (duplicates.isEmpty()) {
            System.out.println("No two students share the same marks.");
        } else {
            System.out.println("Marks shared by more than one student: " + duplicates);
        }
    }

    // Sliding Window: finds the window of k consecutive students (in current order)
    // with the highest average, without recomputing the whole sum each time. O(n).
    public void slidingWindowMaxAverage(int k) {
        if (k <= 0 || k > students.size()) {
            System.out.println("Invalid window size.");
            return;
        }
        int windowSum = 0;
        for (int i = 0; i < k; i++) windowSum += students.get(i).marks;
        int bestSum = windowSum, bestStart = 0;

        for (int i = k; i < students.size(); i++) {
            windowSum += students.get(i).marks - students.get(i - k).marks; // slide: add new, drop old
            if (windowSum > bestSum) {
                bestSum = windowSum;
                bestStart = i - k + 1;
            }
        }
        System.out.println("\n--- Sliding Window (best " + k + "-student streak) ---");
        System.out.printf("Best average: %.2f, starting at %s%n", bestSum / (double) k, students.get(bestStart).name);
    }

    // Prefix Sum: precomputes running totals so the average "so far" at any point
    // is a single lookup instead of re-summing from the start each time. O(n).
    public void showPrefixSumAverages() {
        System.out.println("\n--- Prefix Sum (cumulative average after each student) ---");
        int runningTotal = 0;
        for (int i = 0; i < students.size(); i++) {
            runningTotal += students.get(i).marks;
            double avgSoFar = runningTotal / (double) (i + 1);
            System.out.printf("  after %s: total=%d, avg=%.2f%n", students.get(i).name, runningTotal, avgSoFar);
        }
    }

    // Buckets marks into ranges of 10 (0-9, 10-19, ... 90-100) — a simple histogram, O(n).
    public void showMarksHistogram() {
        int[] buckets = new int[11]; // index 10 handles the exact value 100
        for (Student s : students) buckets[Math.min(s.marks / 10, 10)]++;

        System.out.println("\n--- Marks Histogram ---");
        for (int i = 0; i <= 10; i++) {
            int rangeStart = i * 10;
            int rangeEnd = (i == 10) ? 100 : rangeStart + 9;
            StringBuilder bar = new StringBuilder();
            for (int b = 0; b < buckets[i]; b++) bar.append('*');
            System.out.println("  " + rangeStart + "-" + rangeEnd + ": " + bar + " (" + buckets[i] + ")");
        }
    }

    // --- Binary Search Tree: insert students keyed by marks, then read them back
    // via inorder traversal, which visits a BST in sorted order automatically.
    static class BSTNode {
        Student student;
        BSTNode left, right;
        BSTNode(Student student) { this.student = student; }
    }

    private BSTNode bstRoot;

    public void buildBST() {
        bstRoot = null;
        for (Student s : students) bstRoot = bstInsert(bstRoot, s);
    }

    private BSTNode bstInsert(BSTNode node, Student s) {
        if (node == null) return new BSTNode(s);
        if (s.marks < node.student.marks) node.left = bstInsert(node.left, s);
        else node.right = bstInsert(node.right, s);
        return node;
    }

    public void showBSTInorder() {
        buildBST();
        System.out.println("\n--- Binary Search Tree — Inorder Traversal (sorted output) ---");
        StringBuilder sb = new StringBuilder();
        bstInorder(bstRoot, sb);
        System.out.println(sb.toString().trim());
    }

    private void bstInorder(BSTNode node, StringBuilder sb) {
        if (node == null) return;
        bstInorder(node.left, sb);
        sb.append(node.student.name).append("(").append(node.student.marks).append(") ");
        bstInorder(node.right, sb);
    }

    // Returns the student with the k-th highest marks (k=1 -> topper)
    public void kthHighest(int k) {
        if (k < 1 || k > students.size()) {
            System.out.println("k is out of range.");
            return;
        }
        ArrayList<Student> sorted = new ArrayList<>(students);
        sorted.sort(Comparator.comparingInt((Student s) -> s.marks).reversed());
        Student s = sorted.get(k - 1);
        System.out.println("#" + k + " highest: " + s.name + " (" + s.marks + " marks)");
    }

    // Finds one pair of students whose marks add up to targetSum, using a HashMap for O(n)
    // lookup instead of the brute-force O(n^2) nested loop ("Two Sum" pattern).
    public void pairWithTargetSum(int targetSum) {
        Map<Integer, Student> seen = new HashMap<>(); // marks -> student already visited
        for (Student s : students) {
            int complement = targetSum - s.marks;
            if (seen.containsKey(complement)) {
                System.out.println("Pair found: " + seen.get(complement).name + " (" + complement + ") + "
                        + s.name + " (" + s.marks + ") = " + targetSum);
                return;
            }
            seen.put(s.marks, s);
        }
        System.out.println("No pair of students adds up to " + targetSum + ".");
    }

    // Reverses the student list in place using the two-pointer technique:
    // one pointer at the start, one at the end, swap and move inward. O(n), O(1) extra space.
    public void reverseList() {
        int left = 0, right = students.size() - 1;
        while (left < right) {
            Collections.swap(students, left, right);
            left++;
            right--;
        }
        System.out.println("List reversed (two-pointer swap).");
    }

    // Marks -> letter grade (simple conditional logic)
    public static String getGrade(int marks) {
        if (marks >= 90) return "A";
        if (marks >= 75) return "B";
        if (marks >= 60) return "C";
        if (marks >= 40) return "D";
        return "F";
    }

    // Counts how many students fall in each grade using a HashMap (frequency count), O(n)
    public void showGradeDistribution() {
        Map<String, Integer> counts = new LinkedHashMap<>();
        for (String g : new String[]{"A", "B", "C", "D", "F"}) counts.put(g, 0);

        for (Student s : students) {
            String grade = getGrade(s.marks);
            counts.put(grade, counts.get(grade) + 1);
        }

        System.out.println("\n--- Grade Distribution ---");
        for (Map.Entry<String, Integer> entry : counts.entrySet()) {
            System.out.println(entry.getKey() + ": " + entry.getValue() + " student(s)");
        }
    }

    public void showTopperAndAverage() {
        if (students.isEmpty()) {
            System.out.println("No students added yet.");
            return;
        }
        Student topper = Collections.max(students, Comparator.comparingInt(s -> s.marks));
        double total = 0;
        for (Student s : students) total += s.marks;
        double avg = total / students.size();

        System.out.println("\nTopper: " + topper.name + " (" + topper.marks + " marks)");
        System.out.printf("Class Average: %.2f%n", avg);
    }

    public static void main(String[] args) {
        StudentResultManager manager = new StudentResultManager();

        System.out.println("=== Student Result Manager Demo ===\n");

        manager.addStudent("Rahul", 78);
        manager.addStudent("Priya", 92);
        manager.addStudent("Aman", 65);
        manager.addStudent("Sneha", 88);
        manager.addStudent("Kabir", 92);

        manager.showRanked();
        manager.showTopperAndAverage();
        manager.showGradeDistribution();
        manager.showRecentAdditions();
        manager.bubbleSortByMarks();
        manager.selectionSortByMarks();
        manager.insertionSortByMarks();
        manager.mergeSortByMarks();
        manager.showRecursiveSum();
        manager.findDuplicateMarks();
        manager.slidingWindowMaxAverage(2);
        manager.showPrefixSumAverages();
        manager.showMarksHistogram();
        manager.showBSTInorder();

        System.out.println("\n--- Linear search for 'Sneha' ---");
        manager.search("Sneha");

        System.out.println("\n--- Binary search for marks = 88 ---");
        manager.binarySearchByMarks(88);

        System.out.println("\n--- 2nd highest scorer ---");
        manager.kthHighest(2);

        System.out.println("\n--- Pair of students whose marks sum to 170 ---");
        manager.pairWithTargetSum(170);

        System.out.println("\n--- Reverse the list ---");
        manager.reverseList();
        for (Student s : manager.students) System.out.println("  " + s.name + " - " + s.marks);

        System.out.println("\n--- Deleting 'Aman' ---");
        manager.deleteStudent("Aman");
        manager.showRanked();

        System.out.println("\n--- Undo last action (bring Aman back) ---");
        manager.undo();
        manager.showRanked();

        System.out.println("\n=== Demo complete ===");
    }
}
