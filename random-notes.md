# Random Tech Notes

## Quick Tips for Development

### Performance Optimization
- Always measure before optimizing
- Use `requestAnimationFrame` for smooth animations
- Debounce expensive operations
- Leverage browser caching strategies

### Code Quality
1. Write self-documenting code
2. Keep functions small and focused
3. Use meaningful variable names
4. Comment the "why", not the "what"

## Useful Commands

```bash
# Check disk usage
du -sh *

# Find large files
find . -type f -size +100M

# Git log with graph
git log --oneline --graph --all
```

## React Patterns

**Custom Hook Example:**
```typescript
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}
```

## Random Thoughts

> "Premature optimization is the root of all evil" - Donald Knuth

Sometimes the best code is the code you don't write. Delete more, add less.

---

## Quick Links

- [MDN Web Docs](https://developer.mozilla.org)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [React Docs](https://react.dev)

### TODO
- [ ] Refactor utility functions
- [ ] Add error boundaries
- [ ] Improve test coverage
- [x] Set up CI/CD pipeline

**Last updated:** 2026-02-14
