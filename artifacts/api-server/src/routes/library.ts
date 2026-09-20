import { Router, type IRouter, type Response } from "express";
import { and, desc, eq, ilike, isNull, or, sql } from "drizzle-orm";
import {
  CreateBookBody,
  CreateBookResponse,
  CreateIssueBody,
  CreateIssueResponse,
  CreateStudentBody,
  CreateStudentResponse,
  DeleteBookParams,
  DeleteStudentParams,
  GetBooksQueryParams,
  GetBooksResponse,
  GetDashboardStatsResponse,
  GetIssuesResponse,
  GetStudentsResponse,
  ReturnIssueParams,
  ReturnIssueResponse,
  UpdateBookBody,
  UpdateBookParams,
  UpdateBookResponse,
} from "@workspace/api-zod";
import { db } from "@workspace/db";
import { books, issues, students } from "@workspace/db/schema";

const router: IRouter = Router();

const today = () => new Date().toISOString().slice(0, 10);

class LibraryError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

function sendValidationError(res: Response, message: string) {
  return res.status(400).json({ error: message });
}

function mapBook(book: typeof books.$inferSelect) {
  return {
    id: book.id,
    title: book.title,
    author: book.author,
    isbn: book.isbn,
    category: book.category,
    totalQuantity: book.totalQuantity,
    availableQuantity: book.availableQuantity,
    createdAt: book.createdAt,
  };
}

function mapStudent(student: typeof students.$inferSelect) {
  return {
    id: student.id,
    name: student.name,
    rollNumber: student.rollNumber,
    department: student.department,
    year: student.year,
    email: student.email,
    createdAt: student.createdAt,
  };
}

type JoinedIssue = {
  issue: typeof issues.$inferSelect;
  book: typeof books.$inferSelect;
  student: typeof students.$inferSelect;
};

function mapIssue(row: JoinedIssue) {
  const issueIsOverdue =
    !row.issue.returnDate && new Date(`${row.issue.dueDate}T23:59:59`) < new Date();

  return {
    id: row.issue.id,
    bookId: row.issue.bookId,
    studentId: row.issue.studentId,
    bookTitle: row.book.title,
    studentName: row.student.name,
    rollNumber: row.student.rollNumber,
    issueDate: row.issue.issueDate,
    dueDate: row.issue.dueDate,
    returnDate: row.issue.returnDate,
    status: row.issue.returnDate ? "returned" : issueIsOverdue ? "overdue" : "issued",
  } as const;
}

async function findIssue(id: number, client = db) {
  const rows = await client
    .select({ issue: issues, book: books, student: students })
    .from(issues)
    .innerJoin(books, eq(issues.bookId, books.id))
    .innerJoin(students, eq(issues.studentId, students.id))
    .where(eq(issues.id, id))
    .limit(1);
  return rows[0] as JoinedIssue | undefined;
}

export async function seedLibraryIfEmpty() {
  const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(books);
  if (Number(count) > 0) return;

  const seededBooks = await db
    .insert(books)
    .values([
      {
        title: "Clean Code",
        author: "Robert C. Martin",
        isbn: "9780132350884",
        category: "Computer Science",
        totalQuantity: 6,
        availableQuantity: 5,
      },
      {
        title: "Database System Concepts",
        author: "Abraham Silberschatz",
        isbn: "9780073523323",
        category: "Computer Science",
        totalQuantity: 4,
        availableQuantity: 4,
      },
      {
        title: "The Design of Everyday Things",
        author: "Don Norman",
        isbn: "9780465050659",
        category: "Design",
        totalQuantity: 3,
        availableQuantity: 3,
      },
      {
        title: "Introduction to Algorithms",
        author: "Thomas H. Cormen",
        isbn: "9780262046305",
        category: "Engineering",
        totalQuantity: 5,
        availableQuantity: 5,
      },
    ])
    .returning();

  const seededStudents = await db
    .insert(students)
    .values([
      {
        name: "Aarav Sharma",
        rollNumber: "CSE2023-014",
        department: "Computer Science",
        year: 3,
        email: "aarav.sharma@campus.edu",
      },
      {
        name: "Meera Iyer",
        rollNumber: "ECE2022-008",
        department: "Electronics",
        year: 4,
        email: "meera.iyer@campus.edu",
      },
      {
        name: "Rohan Das",
        rollNumber: "ME2024-022",
        department: "Mechanical",
        year: 2,
        email: "rohan.das@campus.edu",
      },
      {
        name: "Ishita Nair",
        rollNumber: "CSE2023-031",
        department: "Computer Science",
        year: 3,
        email: "ishita.nair@campus.edu",
      },
    ])
    .returning();

  const activeBook = seededBooks.find((book) => book.isbn === "9780132350884");
  const activeStudent = seededStudents.find((student) => student.rollNumber === "CSE2023-014");
  const returnedBook = seededBooks.find((book) => book.isbn === "9780073523323");
  const returnedStudent = seededStudents.find((student) => student.rollNumber === "ECE2022-008");
  if (!activeBook || !activeStudent || !returnedBook || !returnedStudent) return;

  const issueDate = new Date();
  issueDate.setDate(issueDate.getDate() - 2);
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 12);
  const pastIssueDate = new Date();
  pastIssueDate.setDate(pastIssueDate.getDate() - 20);
  const pastDueDate = new Date();
  pastDueDate.setDate(pastDueDate.getDate() - 6);
  const pastReturnDate = new Date();
  pastReturnDate.setDate(pastReturnDate.getDate() - 3);

  await db.insert(issues).values([
    {
      bookId: activeBook.id,
      studentId: activeStudent.id,
      issueDate: issueDate.toISOString().slice(0, 10),
      dueDate: dueDate.toISOString().slice(0, 10),
      status: "issued",
    },
    {
      bookId: returnedBook.id,
      studentId: returnedStudent.id,
      issueDate: pastIssueDate.toISOString().slice(0, 10),
      dueDate: pastDueDate.toISOString().slice(0, 10),
      returnDate: pastReturnDate.toISOString().slice(0, 10),
      status: "returned",
    },
  ]);
}

router.get("/dashboard/stats", async (_req, res) => {
  const [bookTotals, studentTotals, activeIssues, recentRows] = await Promise.all([
    db
      .select({
        total: sql<number>`coalesce(sum(${books.totalQuantity}), 0)`,
        available: sql<number>`coalesce(sum(${books.availableQuantity}), 0)`,
      })
      .from(books),
    db.select({ total: sql<number>`count(*)` }).from(students),
    db.select({ total: sql<number>`count(*)` }).from(issues).where(isNull(issues.returnDate)),
    db
      .select({ issue: issues, book: books, student: students })
      .from(issues)
      .innerJoin(books, eq(issues.bookId, books.id))
      .innerJoin(students, eq(issues.studentId, students.id))
      .orderBy(desc(issues.issueDate))
      .limit(5),
  ]);

  const response = GetDashboardStatsResponse.parse({
    totalBooks: Number(bookTotals[0]?.total ?? 0),
    totalStudents: Number(studentTotals[0]?.total ?? 0),
    issuedBooks: Number(activeIssues[0]?.total ?? 0),
    availableBooks: Number(bookTotals[0]?.available ?? 0),
    recentIssues: recentRows.map((row) => mapIssue(row as JoinedIssue)),
  });
  res.json(response);
});

router.get("/books", async (req, res) => {
  const query = GetBooksQueryParams.safeParse(req.query);
  if (!query.success) return sendValidationError(res, "Invalid book search.");
  const search = query.data.search?.trim();
  const rows = await db
    .select()
    .from(books)
    .where(
      search
        ? or(
            ilike(books.title, `%${search}%`),
            ilike(books.author, `%${search}%`),
            ilike(books.isbn, `%${search}%`),
            ilike(books.category, `%${search}%`),
          )
        : undefined,
    )
    .orderBy(desc(books.createdAt));
  return res.json(GetBooksResponse.parse(rows.map(mapBook)));
});

router.post("/books", async (req, res) => {
  const body = CreateBookBody.safeParse(req.body);
  if (!body.success) return sendValidationError(res, "Please provide all book details.");
  const [book] = await db
    .insert(books)
    .values({ ...body.data, availableQuantity: body.data.totalQuantity })
    .returning();
  return res.status(201).json(CreateBookResponse.parse(mapBook(book)));
});

router.patch("/books/:id", async (req, res) => {
  const params = UpdateBookParams.safeParse(req.params);
  const body = UpdateBookBody.safeParse(req.body);
  if (!params.success || !body.success) return sendValidationError(res, "Invalid book details.");
  const current = await db.select().from(books).where(eq(books.id, params.data.id)).limit(1);
  if (!current[0]) return res.status(404).json({ error: "Book not found." });
  const borrowed = current[0].totalQuantity - current[0].availableQuantity;
  if (body.data.totalQuantity !== undefined && body.data.totalQuantity < borrowed) {
    return res.status(400).json({ error: `Quantity cannot be less than ${borrowed} issued copies.` });
  }
  const [book] = await db
    .update(books)
    .set({
      ...body.data,
      availableQuantity:
        body.data.totalQuantity === undefined
          ? undefined
          : body.data.totalQuantity - borrowed,
    })
    .where(eq(books.id, params.data.id))
    .returning();
  return res.json(UpdateBookResponse.parse(mapBook(book)));
});

router.delete("/books/:id", async (req, res) => {
  const params = DeleteBookParams.safeParse(req.params);
  if (!params.success) return sendValidationError(res, "Invalid book.");
  const active = await db
    .select({ id: issues.id })
    .from(issues)
    .where(and(eq(issues.bookId, params.data.id), isNull(issues.returnDate)))
    .limit(1);
  if (active[0]) return res.status(409).json({ error: "Return active copies before deleting this book." });
  const deleted = await db.delete(books).where(eq(books.id, params.data.id)).returning({ id: books.id });
  if (!deleted[0]) return res.status(404).json({ error: "Book not found." });
  return res.status(204).send();
});

router.get("/students", async (_req, res) => {
  const rows = await db.select().from(students).orderBy(desc(students.createdAt));
  return res.json(GetStudentsResponse.parse(rows.map(mapStudent)));
});

router.post("/students", async (req, res) => {
  const body = CreateStudentBody.safeParse(req.body);
  if (!body.success) return sendValidationError(res, "Please provide valid student details.");
  const [student] = await db.insert(students).values(body.data).returning();
  return res.status(201).json(CreateStudentResponse.parse(mapStudent(student)));
});

router.delete("/students/:id", async (req, res) => {
  const params = DeleteStudentParams.safeParse(req.params);
  if (!params.success) return sendValidationError(res, "Invalid student.");
  const active = await db
    .select({ id: issues.id })
    .from(issues)
    .where(and(eq(issues.studentId, params.data.id), isNull(issues.returnDate)))
    .limit(1);
  if (active[0]) return res.status(409).json({ error: "Return active books before deleting this student." });
  const deleted = await db.delete(students).where(eq(students.id, params.data.id)).returning({ id: students.id });
  if (!deleted[0]) return res.status(404).json({ error: "Student not found." });
  return res.status(204).send();
});

router.get("/issues", async (_req, res) => {
  const rows = await db
    .select({ issue: issues, book: books, student: students })
    .from(issues)
    .innerJoin(books, eq(issues.bookId, books.id))
    .innerJoin(students, eq(issues.studentId, students.id))
    .orderBy(desc(issues.issueDate));
  return res.json(GetIssuesResponse.parse(rows.map((row) => mapIssue(row as JoinedIssue))));
});

router.post("/issues", async (req, res) => {
  const body = CreateIssueBody.safeParse(req.body);
  if (!body.success) return sendValidationError(res, "Please select a student, book, and valid dates.");
  let created: typeof issues.$inferSelect;
  try {
    created = await db.transaction(async (tx) => {
      const [book] = await tx.select().from(books).where(eq(books.id, body.data.bookId)).limit(1);
      const [student] = await tx.select().from(students).where(eq(students.id, body.data.studentId)).limit(1);
      if (!book || !student) throw new LibraryError("Book or student not found.", 404);
      if (book.availableQuantity < 1) throw new LibraryError("This book has no available copies.", 409);
      const [existing] = await tx
        .select({ id: issues.id })
        .from(issues)
        .where(
          and(
            eq(issues.bookId, body.data.bookId),
            eq(issues.studentId, body.data.studentId),
            isNull(issues.returnDate),
          ),
        )
        .limit(1);
      if (existing) throw new LibraryError("This student already has this book issued.", 409);
      await tx
        .update(books)
        .set({ availableQuantity: book.availableQuantity - 1 })
        .where(eq(books.id, book.id));
      const [issue] = await tx
        .insert(issues)
        .values({
          bookId: body.data.bookId,
          studentId: body.data.studentId,
          issueDate: body.data.issueDate.toISOString().slice(0, 10),
          dueDate: body.data.dueDate.toISOString().slice(0, 10),
          status: "issued",
        })
        .returning();
      return issue;
    });
  } catch (error) {
    if (error instanceof LibraryError) {
      return res.status(error.status).json({ error: error.message });
    }
    throw error;
  }
  const row = await findIssue(created.id);
  if (!row) return res.status(500).json({ error: "Unable to load the new issue." });
  return res.status(201).json(CreateIssueResponse.parse(mapIssue(row)));
});

router.post("/issues/:id/return", async (req, res) => {
  const params = ReturnIssueParams.safeParse(req.params);
  if (!params.success) return sendValidationError(res, "Invalid issue.");
  const updated = await db.transaction(async (tx) => {
    const [issue] = await tx.select().from(issues).where(eq(issues.id, params.data.id)).limit(1);
    if (!issue) return null;
    if (issue.returnDate) return issue;
    await tx
      .update(books)
      .set({ availableQuantity: sql`${books.availableQuantity} + 1` })
      .where(eq(books.id, issue.bookId));
    const [returned] = await tx
      .update(issues)
      .set({ returnDate: today(), status: "returned" })
      .where(eq(issues.id, issue.id))
      .returning();
    return returned;
  });
  if (!updated) return res.status(404).json({ error: "Issue not found." });
  const row = await findIssue(updated.id);
  if (!row) return res.status(404).json({ error: "Issue not found." });
  return res.json(ReturnIssueResponse.parse(mapIssue(row)));
});

export default router;