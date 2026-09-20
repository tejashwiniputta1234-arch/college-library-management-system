import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeftRight,
  ArrowRight,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  CircleUserRound,
  Clock3,
  Command,
  Library,
  Menu,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  UserRound,
  UsersRound,
  X,
} from 'lucide-react';
import {
  getGetBooksQueryKey,
  getGetDashboardStatsQueryKey,
  getGetIssuesQueryKey,
  getGetStudentsQueryKey,
  useCreateBook,
  useCreateIssue,
  useCreateStudent,
  useDeleteBook,
  useDeleteStudent,
  useGetBooks,
  useGetDashboardStats,
  useGetIssues,
  useGetStudents,
  useReturnIssue,
  useUpdateBook,
  type Book,
  type Issue,
  type Student,
} from '@workspace/api-client-react';
import { ErrorBoundary } from '@/components/error-boundary';
import NotFound from '@/pages/not-found';
import { Link, Route, Router as WouterRouter, Switch, useLocation } from 'wouter';
import './index.css';

const queryClient = new QueryClient();

type ToastItem = { id: number; message: string; kind: 'success' | 'error' };
type ModalState =
  | { type: 'book'; item?: Book; title?: string; message?: string }
  | { type: 'student'; title?: string; message?: string }
  | { type: 'issue'; title?: string; message?: string }
  | { type: 'confirm'; item?: Book | Student | Issue; title?: string; message?: string }
  | null;

const navItems = [
  { href: '/', label: 'Overview', icon: Library },
  { href: '/books', label: 'Catalogue', icon: BookOpen },
  { href: '/students', label: 'Students', icon: UsersRound },
  { href: '/circulation', label: 'Circulation', icon: ArrowLeftRight },
];

function formatDate(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatShortDate(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}

function todayInput() {
  return new Date().toISOString().slice(0, 10);
}

function addDaysInput(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function errorMessage(error: unknown) {
  if (error && typeof error === 'object' && 'error' in error) return String((error as { error: string }).error);
  return 'Something went wrong. Please try again.';
}

function StatusBadge({ status }: { status: Issue['status'] | 'available' | 'low' | 'out' }) {
  const config = {
    issued: ['badge-warning', 'On loan'],
    returned: ['badge-success', 'Returned'],
    overdue: ['badge-danger', 'Overdue'],
    available: ['badge-success', 'Available'],
    low: ['badge-warning', 'Low stock'],
    out: ['badge-danger', 'Checked out'],
  } as const;
  const [className, label] = config[status];
  return <span className={`badge ${className}`} data-testid={`status-${status}`}>{label}</span>;
}

function LoadingRows({ rows = 5 }: { rows?: number }) {
  return <div aria-label="Loading" data-testid="loading-state">
    {Array.from({ length: rows }).map((_, index) => <div className="skeleton skeleton-line" key={index} />)}
  </div>;
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return <div className="error-box" data-testid="error-state">
    <div>
      <strong>We could not load this view.</strong>
      <p>{message}</p>
    </div>
    <button className="button button-secondary" type="button" onClick={onRetry} data-testid="button-retry">
      <RefreshCw size={14} /> Retry
    </button>
  </div>;
}

function EmptyState({ icon: Icon, title, message, action }: { icon: typeof BookOpen; title: string; message: string; action?: ReactNode }) {
  return <div className="empty-state" data-testid="empty-state">
    <Icon size={28} strokeWidth={1.5} />
    <h3>{title}</h3>
    <p>{message}</p>
    {action}
  </div>;
}

function AppShell({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const current = navItems.find((item) => item.href === location) ?? navItems[0];

  return <div className="app-shell">
    <aside className="sidebar" aria-label="Primary navigation">
      <Link href="/" className="brand" data-testid="link-brand">
        <span className="brand-mark">L</span>
        <span className="brand-title">The Reading Room<span className="brand-subtitle">College library desk</span></span>
      </Link>
      <div className="nav-label">Workspace</div>
      <nav className="nav">
        {navItems.map(({ href, label, icon: Icon }) => <Link href={href} key={href} className={`nav-link ${location === href ? 'active' : ''}`} data-testid={`link-nav-${label.toLowerCase()}`}>
          <Icon size={17} strokeWidth={1.7} /><span>{label}</span>
        </Link>)}
      </nav>
      <div className="sidebar-foot">
        <p>A quieter way to keep knowledge moving.</p>
        <small>LIBRARY DESK · 2024—25</small>
      </div>
    </aside>
    <main className="main-shell">
      <header className="topbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <button className="menu-toggle" type="button" onClick={() => setMobileOpen((open) => !open)} aria-label="Open navigation" data-testid="button-mobile-menu">
            {mobileOpen ? <X size={21} /> : <Menu size={21} />}
          </button>
          <div>
            <div className="topbar-kicker">Library operations / {current.label}</div>
            <div className="topbar-title">Good morning, librarian</div>
          </div>
        </div>
        <div className="topbar-actions">
          <span className="quiet-note">Academic year 2024—25</span>
          <span className="avatar" aria-label="Librarian profile" data-testid="avatar-librarian">LM</span>
        </div>
      </header>
      {mobileOpen && <nav className="mobile-nav" aria-label="Mobile navigation">
        {navItems.map(({ href, label, icon: Icon }) => <Link href={href} key={href} onClick={() => setMobileOpen(false)} className={`nav-link ${location === href ? 'active' : ''}`} data-testid={`link-mobile-${label.toLowerCase()}`}>
          <Icon size={16} /><span>{label}</span>
        </Link>)}
      </nav>}
      {children}
    </main>
  </div>;
}

function Modal({ modal, onClose, children }: { modal: Exclude<ModalState, null>; onClose: () => void; children: ReactNode }) {
  return <div className="overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <div className="modal" role="dialog" aria-modal="true">
      <div className="modal-head">
        <div>
          <h2>{modal.title}</h2>
          {modal.message && <p>{modal.message}</p>}
        </div>
        <button className="button button-quiet" type="button" aria-label="Close dialog" onClick={onClose} data-testid="button-close-dialog"><X size={18} /></button>
      </div>
      <div className="modal-body">{children}</div>
    </div>
  </div>;
}

function Toasts({ toasts, dismiss }: { toasts: ToastItem[]; dismiss: (id: number) => void }) {
  return <div className="toast-stack" aria-live="polite">{toasts.map((toast) => <div key={toast.id} className={`toast ${toast.kind === 'error' ? 'error' : ''}`} data-testid={`toast-${toast.kind}`}>
    {toast.kind === 'success' ? <CheckCircle2 size={17} /> : <CircleAlert size={17} />}
    <span style={{ flex: 1 }}>{toast.message}</span>
    <button className="button button-quiet" type="button" onClick={() => dismiss(toast.id)} aria-label="Dismiss message" data-testid={`button-dismiss-toast-${toast.id}`}><X size={14} /></button>
  </div>)}</div>;
}

function Dashboard() {
  const statsQuery = useGetDashboardStats();
  const stats = statsQuery.data;
  const recent = stats?.recentIssues ?? [];
  return <Page>
    <div className="page-head">
      <div><p className="eyebrow">Monday, 14 October 2024</p><h1>The desk, at a glance.</h1><p className="lede">A clear view of what is available, what is moving, and where a librarian's attention is needed today.</p></div>
      <Link href="/circulation" className="button button-primary" data-testid="link-dashboard-circulation"><ArrowLeftRight size={16} /> Manage circulation</Link>
    </div>
    {statsQuery.isLoading ? <div className="stats-grid">{Array.from({ length: 4 }).map((_, i) => <div className="stat-card skeleton" key={i} />)}</div> : statsQuery.isError ? <ErrorState message={errorMessage(statsQuery.error)} onRetry={() => statsQuery.refetch()} /> : <>
      <div className="stats-grid">
        <StatCard icon={BookOpen} label="Total titles" value={stats?.totalBooks ?? 0} note="Across the catalogue" />
        <StatCard icon={UsersRound} label="Registered students" value={stats?.totalStudents ?? 0} note="Active library members" />
        <StatCard icon={ArrowLeftRight} label="Books on loan" value={stats?.issuedBooks ?? 0} note="Currently in circulation" />
        <StatCard icon={CheckCircle2} label="Available now" value={stats?.availableBooks ?? 0} note="Ready for the next reader" />
      </div>
      <div className="dashboard-grid">
        <section className="panel" data-testid="panel-recent-activity">
          <div className="panel-head"><div><h2>Recent circulation</h2><p>The latest movement across the library.</p></div><Link href="/circulation" className="button button-quiet" data-testid="link-view-circulation">View all <ArrowRight size={15} /></Link></div>
          {recent.length === 0 ? <EmptyState icon={Clock3} title="No circulation yet" message="New issues and returns will appear here as the collection starts moving." action={<Link href="/circulation" className="button button-secondary" data-testid="link-start-issue">Issue a book</Link>} /> : <div className="activity-list">{recent.slice(0, 6).map((issue) => <ActivityItem issue={issue} key={issue.id} />)}</div>}
        </section>
        <section className="panel" data-testid="panel-quick-actions">
          <div className="panel-head"><div><h2>Keep moving</h2><p>Common desk actions, close at hand.</p></div><Command size={18} color="hsl(var(--accent))" /></div>
          <div className="quick-list">
            <Link href="/books" className="quick-action" data-testid="link-quick-books"><span><BookOpen size={17} /><span>Catalogue a title<small>Search, add, or update a book</small></span></span><ChevronRight size={16} /></Link>
            <Link href="/students" className="quick-action" data-testid="link-quick-students"><span><UserRound size={17} /><span>Register a student<small>Add a new library member</small></span></span><ChevronRight size={16} /></Link>
            <Link href="/circulation" className="quick-action" data-testid="link-quick-issue"><span><ArrowLeftRight size={17} /><span>Record an issue<small>Put a book in a reader's hands</small></span></span><ChevronRight size={16} /></Link>
          </div>
        </section>
      </div>
    </>}
  </Page>;
}

function StatCard({ icon: Icon, label, value, note }: { icon: typeof BookOpen; label: string; value: number; note: string }) {
  return <div className="stat-card" data-testid={`stat-${label.toLowerCase().replaceAll(' ', '-')}`}>
    <div className="stat-label"><span>{label}</span><Icon size={17} color="hsl(var(--accent))" /></div>
    <div className="stat-value">{value.toLocaleString()}</div>
    <div className="stat-note">{note}</div>
  </div>;
}

function ActivityItem({ issue }: { issue: Issue }) {
  return <div className="activity-item" data-testid={`activity-${issue.id}`}>
    <div className="activity-icon">{issue.status === 'returned' ? <Check size={15} /> : <ArrowLeftRight size={15} />}</div>
    <div><div className="activity-title">{issue.bookTitle}</div><div className="activity-subtitle">{issue.status === 'returned' ? `Returned by ${issue.studentName}` : `With ${issue.studentName} · ${issue.rollNumber}`}</div></div>
    <div className="activity-date">{formatShortDate(issue.returnDate ?? issue.issueDate)}<br /><StatusBadge status={issue.status} /></div>
  </div>;
}

function Page({ children }: { children: ReactNode }) {
  return <div className="page">{children}</div>;
}

function BooksPage({ notify, openModal }: { notify: (message: string, kind?: 'success' | 'error') => void; openModal: (modal: Exclude<ModalState, null>) => void }) {
  const [search, setSearch] = useState('');
  const [querySearch, setQuerySearch] = useState('');
  const booksQuery = useGetBooks(querySearch ? { search: querySearch } : undefined, { query: { queryKey: getGetBooksQueryKey(querySearch ? { search: querySearch } : undefined) } });
  useEffect(() => { const timer = window.setTimeout(() => setQuerySearch(search.trim()), 250); return () => window.clearTimeout(timer); }, [search]);
  const books = booksQuery.data ?? [];

  return <Page>
    <div className="page-head"><div><p className="eyebrow">Collection / Catalogue</p><h1>Books on the shelves.</h1><p className="lede">Keep every title findable, every copy accounted for, and every shelf ready for the next student.</p></div><button className="button button-primary" type="button" onClick={() => openModal({ type: 'book', title: 'Add a book', message: 'Create a clear record for a new title.' })} data-testid="button-add-book"><Plus size={16} /> Add book</button></div>
    <section className="panel">
      <div className="toolbar"><div className="search-wrap"><Search size={16} /><input className="input" type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search title, author, ISBN, or category" aria-label="Search catalogue" data-testid="input-search-books" /></div><span className="quiet-note">{books.length} {books.length === 1 ? 'title' : 'titles'} shown</span></div>
      {booksQuery.isLoading ? <LoadingRows /> : booksQuery.isError ? <ErrorState message={errorMessage(booksQuery.error)} onRetry={() => booksQuery.refetch()} /> : books.length === 0 ? <EmptyState icon={BookOpen} title={search ? 'No matching titles' : 'The catalogue is ready for its first title'} message={search ? 'Try a different search term or clear the search.' : 'Add the first book to start building this collection.'} action={search ? <button className="button button-secondary" type="button" onClick={() => setSearch('')} data-testid="button-clear-book-search">Clear search</button> : <button className="button button-primary" type="button" onClick={() => openModal({ type: 'book', title: 'Add a book' })} data-testid="button-empty-add-book"><Plus size={15} /> Add a book</button>} /> : <BookTable books={books} openModal={openModal} />}
    </section>
  </Page>;
}

function BookTable({ books, openModal }: { books: Book[]; openModal: (modal: Exclude<ModalState, null>) => void }) {
  return <div className="table-wrap"><table className="data-table"><thead><tr><th>Title & author</th><th>Category</th><th>ISBN</th><th>Availability</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>{books.map((book) => {
    const availability = book.availableQuantity === 0 ? 'out' : book.availableQuantity <= Math.max(1, Math.floor(book.totalQuantity * .2)) ? 'low' : 'available';
    return <tr key={book.id} data-testid={`row-book-${book.id}`}><td><div className="primary-cell">{book.title}</div><div className="secondary-cell">{book.author}</div></td><td><span className="badge badge-neutral">{book.category}</span></td><td className="mono">{book.isbn}</td><td><StatusBadge status={availability} /><div className="secondary-cell">{book.availableQuantity} of {book.totalQuantity} copies</div></td><td><div className="row-actions"><button className="button button-quiet" type="button" aria-label={`Edit ${book.title}`} onClick={() => openModal({ type: 'book', item: book, title: 'Edit book', message: 'Update the record without losing its circulation history.' })} data-testid={`button-edit-book-${book.id}`}><Pencil size={15} /></button><button className="button button-quiet" type="button" aria-label={`Delete ${book.title}`} onClick={() => openModal({ type: 'confirm', item: book, title: 'Delete this book?', message: `This will remove “${book.title}” from the catalogue.` })} data-testid={`button-delete-book-${book.id}`}><Trash2 size={15} /></button></div></td></tr>;
  })}</tbody></table></div>;
}

function StudentsPage({ notify, openModal }: { notify: (message: string, kind?: 'success' | 'error') => void; openModal: (modal: Exclude<ModalState, null>) => void }) {
  const [search, setSearch] = useState('');
  const studentsQuery = useGetStudents();
  const students = useMemo(() => (studentsQuery.data ?? []).filter((student) => `${student.name} ${student.rollNumber} ${student.department} ${student.email}`.toLowerCase().includes(search.toLowerCase())), [studentsQuery.data, search]);
  return <Page>
    <div className="page-head"><div><p className="eyebrow">People / Directory</p><h1>Know every reader.</h1><p className="lede">A dependable directory for the students who borrow, discover, and return the collection.</p></div><button className="button button-primary" type="button" onClick={() => openModal({ type: 'student', title: 'Register a student', message: 'Add a student to the library directory.' })} data-testid="button-add-student"><Plus size={16} /> Add student</button></div>
    <section className="panel">
      <div className="toolbar"><div className="search-wrap"><Search size={16} /><input className="input" type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by name, roll number, department, or email" aria-label="Search students" data-testid="input-search-students" /></div><span className="quiet-note">{students.length} {students.length === 1 ? 'student' : 'students'} shown</span></div>
      {studentsQuery.isLoading ? <LoadingRows /> : studentsQuery.isError ? <ErrorState message={errorMessage(studentsQuery.error)} onRetry={() => studentsQuery.refetch()} /> : students.length === 0 ? <EmptyState icon={UsersRound} title={search ? 'No students match' : 'No students registered'} message={search ? 'Try a different name, roll number, or department.' : 'Register the first student to begin issuing books.'} action={!search && <button className="button button-primary" type="button" onClick={() => openModal({ type: 'student', title: 'Register a student' })} data-testid="button-empty-add-student"><Plus size={15} /> Register student</button>} /> : <StudentTable students={students} openModal={openModal} />}
    </section>
  </Page>;
}

function StudentTable({ students, openModal }: { students: Student[]; openModal: (modal: Exclude<ModalState, null>) => void }) {
  return <div className="table-wrap"><table className="data-table"><thead><tr><th>Student</th><th>Department</th><th>Year</th><th>Contact</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>{students.map((student) => <tr key={student.id} data-testid={`row-student-${student.id}`}><td><div className="primary-cell">{student.name}</div><div className="secondary-cell mono">{student.rollNumber}</div></td><td>{student.department}</td><td><span className="badge badge-neutral">Year {student.year}</span></td><td className="secondary-cell">{student.email}</td><td><div className="row-actions"><button className="button button-quiet" type="button" aria-label={`Delete ${student.name}`} onClick={() => openModal({ type: 'confirm', item: student, title: 'Remove this student?', message: `This will remove ${student.name} from the directory.` })} data-testid={`button-delete-student-${student.id}`}><Trash2 size={15} /></button></div></td></tr>)}</tbody></table></div>;
}

function CirculationPage({ notify, openModal }: { notify: (message: string, kind?: 'success' | 'error') => void; openModal: (modal: Exclude<ModalState, null>) => void }) {
  const issuesQuery = useGetIssues();
  const issues = issuesQuery.data ?? [];
  const [tab, setTab] = useState<'active' | 'completed'>('active');
  const visible = issues.filter((issue) => tab === 'active' ? issue.status !== 'returned' : issue.status === 'returned');
  return <Page>
    <div className="page-head"><div><p className="eyebrow">Circulation / Desk log</p><h1>Keep books moving.</h1><p className="lede">Issue a title in a few careful steps, then close the loop when it makes its way back.</p></div><button className="button button-primary" type="button" onClick={() => openModal({ type: 'issue', title: 'Issue a book', message: 'Pair an available title with a registered student.' })} data-testid="button-issue-book"><ArrowLeftRight size={16} /> Issue a book</button></div>
    <section className="panel">
      <div className="toolbar"><div style={{ display: 'flex', gap: 5 }}><button className={`button ${tab === 'active' ? 'button-primary' : 'button-secondary'}`} type="button" onClick={() => setTab('active')} data-testid="button-tab-active">Active loans</button><button className={`button ${tab === 'completed' ? 'button-primary' : 'button-secondary'}`} type="button" onClick={() => setTab('completed')} data-testid="button-tab-completed">Completed returns</button></div><span className="quiet-note">{visible.length} records</span></div>
      {issuesQuery.isLoading ? <LoadingRows /> : issuesQuery.isError ? <ErrorState message={errorMessage(issuesQuery.error)} onRetry={() => issuesQuery.refetch()} /> : visible.length === 0 ? <EmptyState icon={ArrowLeftRight} title={tab === 'active' ? 'No active loans' : 'No returns recorded'} message={tab === 'active' ? 'The active desk is clear. Issue a book when a student is ready.' : 'Completed returns will remain here as a quiet record of the collection in motion.'} action={tab === 'active' && <button className="button button-primary" type="button" onClick={() => openModal({ type: 'issue', title: 'Issue a book' })} data-testid="button-empty-issue-book"><Plus size={15} /> Issue a book</button>} /> : <IssueTable issues={visible} openModal={openModal} />}
    </section>
  </Page>;
}

function IssueTable({ issues, openModal }: { issues: Issue[]; openModal: (modal: Exclude<ModalState, null>) => void }) {
  return <div className="table-wrap"><table className="data-table"><thead><tr><th>Book</th><th>Reader</th><th>Issued</th><th>Due</th><th>Status</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>{issues.map((issue) => <tr key={issue.id} data-testid={`row-issue-${issue.id}`}><td><div className="primary-cell">{issue.bookTitle}</div><div className="secondary-cell mono">Record #{String(issue.id).padStart(4, '0')}</div></td><td><div className="primary-cell">{issue.studentName}</div><div className="secondary-cell mono">{issue.rollNumber}</div></td><td className="mono">{formatDate(issue.issueDate)}</td><td className="mono">{formatDate(issue.dueDate)}</td><td><StatusBadge status={issue.status} />{issue.returnDate && <div className="secondary-cell">Returned {formatDate(issue.returnDate)}</div>}</td><td><div className="row-actions">{issue.status !== 'returned' && <button className="button button-secondary" type="button" onClick={() => openModal({ type: 'confirm', item: issue, title: 'Record this return?', message: `Mark “${issue.bookTitle}” as returned by ${issue.studentName}.` })} data-testid={`button-return-issue-${issue.id}`}><Check size={14} /> Return</button>}</div></td></tr>)}</tbody></table></div>;
}

function BookForm({ item, close, notify }: { item?: Book; close: () => void; notify: (message: string, kind?: 'success' | 'error') => void }) {
  const queryClient = useQueryClient();
  const create = useCreateBook();
  const update = useUpdateBook();
  const [form, setForm] = useState({ title: item?.title ?? '', author: item?.author ?? '', isbn: item?.isbn ?? '', category: item?.category ?? '', totalQuantity: String(item?.totalQuantity ?? 1) });
  const [formError, setFormError] = useState('');
  const saving = create.isPending || update.isPending;
  const change = (field: keyof typeof form, value: string) => setForm((current) => ({ ...current, [field]: value }));
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!form.title.trim() || !form.author.trim() || !form.isbn.trim() || !form.category.trim() || Number(form.totalQuantity) < 1) { setFormError('Fill in every field and use at least one copy.'); return; }
    setFormError('');
    const data = { title: form.title.trim(), author: form.author.trim(), isbn: form.isbn.trim(), category: form.category.trim(), totalQuantity: Number(form.totalQuantity) };
    const options = { onSuccess: () => { queryClient.invalidateQueries({ queryKey: getGetBooksQueryKey() }); queryClient.invalidateQueries({ queryKey: getGetDashboardStatsQueryKey() }); close(); notify(item ? 'Book updated in the catalogue.' : 'Book added to the catalogue.'); }, onError: (error: unknown) => setFormError(errorMessage(error)) };
    if (item) update.mutate({ id: item.id, data }, options); else create.mutate({ data }, options);
  };
  return <form onSubmit={submit} data-testid="form-book"><div className="form-grid">
    <div className="form-field full"><label htmlFor="book-title">Title</label><input id="book-title" className="input" value={form.title} onChange={(event) => change('title', event.target.value)} placeholder="e.g. The Republic" data-testid="input-book-title" /></div>
    <div className="form-field"><label htmlFor="book-author">Author</label><input id="book-author" className="input" value={form.author} onChange={(event) => change('author', event.target.value)} placeholder="e.g. Plato" data-testid="input-book-author" /></div>
    <div className="form-field"><label htmlFor="book-category">Category</label><input id="book-category" className="input" value={form.category} onChange={(event) => change('category', event.target.value)} placeholder="e.g. Philosophy" data-testid="input-book-category" /></div>
    <div className="form-field"><label htmlFor="book-isbn">ISBN</label><input id="book-isbn" className="input mono" value={form.isbn} onChange={(event) => change('isbn', event.target.value)} placeholder="978..." data-testid="input-book-isbn" /></div>
    <div className="form-field"><label htmlFor="book-quantity">Total copies</label><input id="book-quantity" className="input" type="number" min="1" value={form.totalQuantity} onChange={(event) => change('totalQuantity', event.target.value)} data-testid="input-book-quantity" /></div>
  </div>{formError && <div className="field-error" style={{ marginTop: 12 }} data-testid="error-book-form">{formError}</div>}<div className="modal-foot"><button className="button button-secondary" type="button" onClick={close} data-testid="button-cancel-book">Cancel</button><button className="button button-primary" type="submit" disabled={saving} data-testid="button-save-book">{saving ? 'Saving…' : item ? 'Save changes' : 'Add book'}</button></div></form>;
}

function StudentForm({ close, notify }: { close: () => void; notify: (message: string, kind?: 'success' | 'error') => void }) {
  const queryClient = useQueryClient();
  const create = useCreateStudent();
  const [form, setForm] = useState({ name: '', rollNumber: '', department: '', year: '1', email: '' });
  const [formError, setFormError] = useState('');
  const change = (field: keyof typeof form, value: string) => setForm((current) => ({ ...current, [field]: value }));
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!form.name.trim() || !form.rollNumber.trim() || !form.department.trim() || !form.email.trim() || Number(form.year) < 1 || Number(form.year) > 6) { setFormError('Complete the student details with a year between 1 and 6.'); return; }
    create.mutate({ data: { name: form.name.trim(), rollNumber: form.rollNumber.trim(), department: form.department.trim(), year: Number(form.year), email: form.email.trim() } }, { onSuccess: () => { queryClient.invalidateQueries({ queryKey: getGetStudentsQueryKey() }); queryClient.invalidateQueries({ queryKey: getGetDashboardStatsQueryKey() }); close(); notify('Student added to the directory.'); }, onError: (error: unknown) => setFormError(errorMessage(error)) });
  };
  return <form onSubmit={submit} data-testid="form-student"><div className="form-grid">
    <div className="form-field full"><label htmlFor="student-name">Full name</label><input id="student-name" className="input" value={form.name} onChange={(event) => change('name', event.target.value)} placeholder="e.g. Amina Das" data-testid="input-student-name" /></div>
    <div className="form-field"><label htmlFor="student-roll">Roll number</label><input id="student-roll" className="input mono" value={form.rollNumber} onChange={(event) => change('rollNumber', event.target.value)} placeholder="e.g. CS-24-018" data-testid="input-student-roll" /></div>
    <div className="form-field"><label htmlFor="student-year">Year</label><select id="student-year" className="select" value={form.year} onChange={(event) => change('year', event.target.value)} data-testid="select-student-year">{[1, 2, 3, 4, 5, 6].map((year) => <option value={year} key={year}>Year {year}</option>)}</select></div>
    <div className="form-field full"><label htmlFor="student-department">Department</label><input id="student-department" className="input" value={form.department} onChange={(event) => change('department', event.target.value)} placeholder="e.g. Computer Science" data-testid="input-student-department" /></div>
    <div className="form-field full"><label htmlFor="student-email">Email address</label><input id="student-email" className="input" type="email" value={form.email} onChange={(event) => change('email', event.target.value)} placeholder="student@college.edu" data-testid="input-student-email" /></div>
  </div>{formError && <div className="field-error" style={{ marginTop: 12 }} data-testid="error-student-form">{formError}</div>}<div className="modal-foot"><button className="button button-secondary" type="button" onClick={close} data-testid="button-cancel-student">Cancel</button><button className="button button-primary" type="submit" disabled={create.isPending} data-testid="button-save-student">{create.isPending ? 'Saving…' : 'Register student'}</button></div></form>;
}

function IssueForm({ close, notify }: { close: () => void; notify: (message: string, kind?: 'success' | 'error') => void }) {
  const queryClient = useQueryClient();
  const booksQuery = useGetBooks();
  const studentsQuery = useGetStudents();
  const create = useCreateIssue();
  const books = (booksQuery.data ?? []).filter((book) => book.availableQuantity > 0);
  const students = studentsQuery.data ?? [];
  const [bookId, setBookId] = useState('');
  const [studentId, setStudentId] = useState('');
  const [issueDate, setIssueDate] = useState(todayInput());
  const [dueDate, setDueDate] = useState(addDaysInput(14));
  const [formError, setFormError] = useState('');
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!bookId || !studentId || !issueDate || !dueDate) { setFormError('Choose a title, a student, and both dates.'); return; }
    if (new Date(dueDate) < new Date(issueDate)) { setFormError('Due date must be on or after the issue date.'); return; }
    create.mutate({ data: { bookId: Number(bookId), studentId: Number(studentId), issueDate, dueDate } }, { onSuccess: () => { queryClient.invalidateQueries({ queryKey: getGetIssuesQueryKey() }); queryClient.invalidateQueries({ queryKey: getGetBooksQueryKey() }); queryClient.invalidateQueries({ queryKey: getGetDashboardStatsQueryKey() }); close(); notify('Book issued and circulation record created.'); }, onError: (error: unknown) => setFormError(errorMessage(error)) });
  };
  const loading = booksQuery.isLoading || studentsQuery.isLoading;
  return <form onSubmit={submit} data-testid="form-issue"><div className="form-grid">
    <div className="form-field full"><label htmlFor="issue-book">Available title</label><select id="issue-book" className="select" value={bookId} onChange={(event) => setBookId(event.target.value)} disabled={loading} data-testid="select-issue-book"><option value="">{loading ? 'Loading titles…' : books.length ? 'Choose an available title' : 'No available titles'}</option>{books.map((book) => <option key={book.id} value={book.id}>{book.title} · {book.availableQuantity} available</option>)}</select></div>
    <div className="form-field full"><label htmlFor="issue-student">Student</label><select id="issue-student" className="select" value={studentId} onChange={(event) => setStudentId(event.target.value)} disabled={loading} data-testid="select-issue-student"><option value="">{loading ? 'Loading students…' : students.length ? 'Choose a registered student' : 'No students registered'}</option>{students.map((student) => <option key={student.id} value={student.id}>{student.name} · {student.rollNumber}</option>)}</select></div>
    <div className="form-field"><label htmlFor="issue-date">Issue date</label><input id="issue-date" className="input" type="date" value={issueDate} onChange={(event) => setIssueDate(event.target.value)} data-testid="input-issue-date" /></div>
    <div className="form-field"><label htmlFor="due-date">Due date</label><input id="due-date" className="input" type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} data-testid="input-due-date" /></div>
  </div>{formError && <div className="field-error" style={{ marginTop: 12 }} data-testid="error-issue-form">{formError}</div>}<div className="modal-foot"><button className="button button-secondary" type="button" onClick={close} data-testid="button-cancel-issue">Cancel</button><button className="button button-primary" type="submit" disabled={create.isPending || loading || !books.length || !students.length} data-testid="button-save-issue">{create.isPending ? 'Recording…' : 'Issue book'}</button></div></form>;
}

function ConfirmAction({ modal, close, notify }: { modal: { type: 'confirm'; item?: Book | Student | Issue; title?: string; message?: string }; close: () => void; notify: (message: string, kind?: 'success' | 'error') => void }) {
  const queryClient = useQueryClient();
  const deleteBook = useDeleteBook();
  const deleteStudent = useDeleteStudent();
  const returnIssue = useReturnIssue();
  const item = modal.item;
  const pending = deleteBook.isPending || deleteStudent.isPending || returnIssue.isPending;
  const submit = () => {
    if (!item) return;
    if ('bookTitle' in item) returnIssue.mutate({ id: item.id }, { onSuccess: () => { queryClient.invalidateQueries({ queryKey: getGetIssuesQueryKey() }); queryClient.invalidateQueries({ queryKey: getGetBooksQueryKey() }); queryClient.invalidateQueries({ queryKey: getGetDashboardStatsQueryKey() }); close(); notify('Return recorded. The book is available again.'); }, onError: (error: unknown) => notify(errorMessage(error), 'error') });
    else if ('isbn' in item) deleteBook.mutate({ id: item.id }, { onSuccess: () => { queryClient.invalidateQueries({ queryKey: getGetBooksQueryKey() }); queryClient.invalidateQueries({ queryKey: getGetDashboardStatsQueryKey() }); close(); notify('Book removed from the catalogue.'); }, onError: (error: unknown) => notify(errorMessage(error), 'error') });
    else deleteStudent.mutate({ id: item.id }, { onSuccess: () => { queryClient.invalidateQueries({ queryKey: getGetStudentsQueryKey() }); queryClient.invalidateQueries({ queryKey: getGetDashboardStatsQueryKey() }); close(); notify('Student removed from the directory.'); }, onError: (error: unknown) => notify(errorMessage(error), 'error') });
  };
  return <div><div style={{ background: 'hsl(var(--secondary) / .55)', borderRadius: 9, padding: 14, fontSize: 13, lineHeight: 1.5 }}><CircleAlert size={18} color="hsl(var(--accent))" style={{ marginBottom: 8 }} /><div>{modal.message}</div></div><div className="modal-foot"><button className="button button-secondary" type="button" onClick={close} data-testid="button-cancel-confirm">Cancel</button><button className={`button ${'bookTitle' in (item ?? {}) ? 'button-primary' : 'button-danger'}`} type="button" onClick={submit} disabled={pending} data-testid="button-confirm-action">{pending ? 'Working…' : 'Confirm'}</button></div></div>;
}

function Workspace() {
  const [modal, setModal] = useState<ModalState>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const notify = (message: string, kind: 'success' | 'error' = 'success') => {
    const id = Date.now();
    setToasts((current) => [...current, { id, message, kind }]);
    window.setTimeout(() => setToasts((current) => current.filter((toast) => toast.id !== id)), 4500);
  };
  const close = () => setModal(null);
  return <AppShell>
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/books">{() => <BooksPage notify={notify} openModal={setModal} />}</Route>
      <Route path="/students">{() => <StudentsPage notify={notify} openModal={setModal} />}</Route>
      <Route path="/circulation">{() => <CirculationPage notify={notify} openModal={setModal} />}</Route>
      <Route component={NotFound} />
    </Switch>
    {modal?.type === 'book' && <Modal modal={modal} onClose={close}><BookForm item={modal.item && 'isbn' in modal.item ? modal.item : undefined} close={close} notify={notify} /></Modal>}
    {modal?.type === 'student' && <Modal modal={modal} onClose={close}><StudentForm close={close} notify={notify} /></Modal>}
    {modal?.type === 'issue' && <Modal modal={modal} onClose={close}><IssueForm close={close} notify={notify} /></Modal>}
    {modal?.type === 'confirm' && <Modal modal={modal} onClose={close}><ConfirmAction modal={modal} close={close} notify={notify} /></Modal>}
    <Toasts toasts={toasts} dismiss={(id) => setToasts((current) => current.filter((toast) => toast.id !== id))} />
  </AppShell>;
}

function Router() {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}><Workspace /></ErrorBoundary>;
}

function App() {
  return <QueryClientProvider client={queryClient}><WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}><Router /></WouterRouter></QueryClientProvider>;
}

export default App;