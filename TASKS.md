# DoulaFlow — Tasks

## In Progress
- Intake form system (Claude Code implementing)

## Todo — Phase 1 Cleanup

### Responsiveness
- Add horizontal scroll to client list table when browser width is
  reduced — currently columns get clipped with no scrollbar
  Fix: wrap the table in overflow-x-auto in ClientList.tsx and ensure
  the table has a min-width so columns don't collapse

### Calendar
- Add due dates as events on the calendar in pink/rose color
  distinct from appointment events (currently green)
  Implementation: in src/app/(app)/calendar/page.tsx, fetch clients
  with due_date set and add them as all-day events with a pink color
  Use a different eventPropGetter style for due_date events vs
  appointment events

## Backlog
- See ROADMAP.md for Phase 2-5 features