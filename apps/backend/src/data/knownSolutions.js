export const KNOWN_SOLUTIONS = [
    {
        problemSlug: 'two-sum',
        language: 'python3',
        source: 'placeholder-corpus',
        code: `
class Solution:
    def twoSum(self, nums: List[int], target: int) -> List[int]:
        seen = {}
        for i, n in enumerate(nums):
            complement = target - n
            if complement in seen:
                return [seen[complement], i]
            seen[n] = i
        return []
`,
    },
    {
        problemSlug: 'reverse-linked-list',
        language: 'python3',
        source: 'placeholder-corpus',
        code: `
class Solution:
    def reverseList(self, head: Optional[ListNode]) -> Optional[ListNode]:
        prev = None
        curr = head
        while curr:
            nxt = curr.next
            curr.next = prev
            prev = curr
            curr = nxt
        return prev
`,
    },
    {
        problemSlug: 'valid-parentheses',
        language: 'python3',
        source: 'placeholder-corpus',
        code: `
class Solution:
    def isValid(self, s: str) -> bool:
        stack = []
        pairs = {')': '(', ']': '[', '}': '{'}
        for c in s:
            if c in pairs.values():
                stack.append(c)
            elif not stack or stack.pop() != pairs[c]:
                return False
        return not stack
`,
    },
];
//# sourceMappingURL=knownSolutions.js.map