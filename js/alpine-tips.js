document.addEventListener('alpine:init', () => {
  Alpine.data('tipCarousel', () => ({
    tips: [
      { title: 'Binary Search', text: 'Only works on sorted data — each step halves the search space, giving O(log n) instead of O(n).' },
      { title: 'Stack vs Queue', text: 'Stack = LIFO (last in, first out). Queue = FIFO (first in, first out). Undo uses a Stack; Recent Additions uses a Queue.' },
      { title: 'HashMap Lookups', text: 'Average O(1) lookup, insert, and delete — the trade-off is no guaranteed ordering.' },
      { title: 'Merge Sort', text: 'Divide and conquer: split until single elements, then merge back in sorted order. O(n log n) every time, unlike Bubble/Selection/Insertion.' },
      { title: 'BST Inorder Traversal', text: 'Visiting left, node, right on a Binary Search Tree always produces values in sorted order.' },
      { title: 'Dynamic Programming', text: 'Memoization stores results of expensive calls so they are not recomputed — turns exponential recursion into linear time.' },
      { title: 'Two Pointers', text: 'Using two indices moving toward or away from each other solves many array problems in O(n) with no extra space.' },
      { title: 'Union-Find', text: 'Path compression flattens the tree during lookups, keeping future find() calls nearly O(1).' },
    ],
    index: 0,
    get current() { return this.tips[this.index]; },
    next() { this.index = (this.index + 1) % this.tips.length; },
    prev() { this.index = (this.index - 1 + this.tips.length) % this.tips.length; },
  }));
});
