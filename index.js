import express from 'express';
import { MongoClient, ObjectId } from 'mongodb';
import cors from 'cors';
import 'dotenv/config'
import { createRemoteJWKSet, jwtVerify } from 'jose';

const app = express();
app.use(cors());
app.use(express.json());
const PORT = process.env.PORT || 8000;

const client = new MongoClient(process.env.MONGODB_URI);

export async function connectToMongoDB() {
  try {
    await client.connect();
    console.log("You successfully connected to MongoDB!");
    return client;
  } catch (err) {
    console.dir(err);
  }
}
const mongoClient = await connectToMongoDB();
const db = mongoClient.db('book-nook');
const booksCollection = db.collection('books');
const borrowedBooksCollection = db.collection('borrowedBooks');
await borrowedBooksCollection.dropIndex("userEmail_1_bookId_1");

await borrowedBooksCollection.createIndex(
  { userEmail: 1, bookId: 1 },
  { unique: true }
);

const verifyToken=async(req,res,next)=>{
const authHeader=req.headers.authorization;
if(!authHeader){
  return res.status(401).send({msg:"Unauthorized"})
}
const token=authHeader.split(" ")[1];
const jwks= createRemoteJWKSet(new URL(`${process.env.CLIENT_URL}/api/auth/jwks`))
try{
  const {payload}=await jwtVerify(token,jwks);
  next();
}catch(error){
return res.status(500).send({msg:"Server Error!"})
}
}

app.get('/', (req, res) => {
  res.send('Hello World!');
});

app.get("/all-books", async (req, res) => {
  try {
    const allBooks = await booksCollection.find().toArray();
    res.json(allBooks);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch all books' });
  }
});

app.get("/new-arrivals", async (req, res) => {
  try {
    const newArrivals = await booksCollection.find().sort({ _id: -1 }).limit(6).toArray();
    res.json(newArrivals);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch new arrivals' });
  }
});

app.get("/book/:id",verifyToken, async (req, res) => {
  try {
    const bookId = req.params.id;
    const book = await booksCollection.findOne({ _id: new ObjectId(bookId) });
    if (!book) {
      return res.status(404).json({ error: 'Book not found' });
    }
    res.json(book);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch book' });
  }
});

app.get("/my-books",verifyToken, async (req, res) => {
  try {
    const email = req.query.email;

    const myBooks = await booksCollection
      .find({ userEmail: email })
      .toArray();

    res.json(myBooks);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch books" });
  }
});

app.get("/my-borrows",verifyToken, async (req, res) => {
  try {
    const email = req.query.email;

    const myBorrows = await borrowedBooksCollection
      .find({ userEmail: email })
      .toArray();

    res.json(myBorrows);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch borrowed books" });
  }
});

app.post("/add-book",verifyToken, async (req, res) => {
  try {
    const newBook = {
      ...req.body,
      totalCopies: Number(req.body.totalCopies),
    };

    if (!Number.isInteger(newBook.totalCopies) || newBook.totalCopies < 1) {
      return res.status(400).json({ message: "Enter a valid number of copies" });
    }

    const result = await booksCollection.insertOne(newBook);

    res.status(201).json({
      success: true,
      message: "Book added successfully",
      insertedId: result.insertedId,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to add book" });
  }
});

app.post("/borrow-book",verifyToken, async (req, res) => {
  try {
    const borrowedBook = req.body;
    const { bookId, userEmail } = borrowedBook;

    if (!ObjectId.isValid(bookId)) {
      return res.status(400).json({ message: "Invalid book ID" });
    }

    const alreadyBorrowed = await borrowedBooksCollection.findOne({
      userEmail,
      bookId: new ObjectId(bookId),
      status: "borrowed",
    });

    if (alreadyBorrowed) {
      return res.status(409).json({
        success: false,
        message: "You have already borrowed this book",
      });
    }

    const updateResult = await booksCollection.updateOne(
      {
        _id: new ObjectId(bookId),
        totalCopies: { $gt: 0 },
      },
      {
        $inc: { totalCopies: -1 },
      }
    );

    if (updateResult.modifiedCount === 0) {
      return res.status(400).json({
        success: false,
        message: "Book is not available",
      });
    }

    try {
      await borrowedBooksCollection.insertOne({
        ...borrowedBook,
        bookId: new ObjectId(bookId),
        status: "borrowed",
      });
    } catch (error) {
      
      await booksCollection.updateOne(
        { _id: new ObjectId(bookId) },
        { $inc: { totalCopies: 1 } }
      );

      if (error.code === 11000) {
        return res.status(409).json({
          success: false,
          message: "You have already borrowed this book",
        });
      }

      throw error;
    }

    res.status(201).json({
      success: true,
      message: "Book borrowed successfully",
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to borrow book" });
  }
});

app.patch("/update-book/:id",verifyToken, async (req, res) => {
  try {
    const bookId = req.params.id;
    const updatedBook = { ...req.body };
    delete updatedBook._id; 

    if (updatedBook.totalCopies !== undefined) {
      updatedBook.totalCopies = Number(updatedBook.totalCopies);
      if (!Number.isInteger(updatedBook.totalCopies) || updatedBook.totalCopies < 0) {
        return res.status(400).json({ message: "Invalid number of copies" });
      }
    }

    await booksCollection.updateOne(
      { _id: new ObjectId(bookId) },
      { $set: updatedBook }
    );
    res.json({ success: true, message: "Book updated successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update book" });
  }
});

app.delete("/delete-book/:id",verifyToken, async (req, res) => {
  try {
    const bookId = req.params.id;
    const result = await booksCollection.deleteOne({ _id: new ObjectId(bookId) });
    res.status(201).json({
      success: true,
      message: "Book deleted successfully",
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete book' });
  }
});

app.delete("/return-book/:id",verifyToken, async (req, res) => {
  try {
    const borrowId = req.params.id;

    if (!ObjectId.isValid(borrowId)) {
      return res.status(400).json({ message: "Invalid borrow ID" });
    }

    const borrowedBook = await borrowedBooksCollection.findOne({
      _id: new ObjectId(borrowId),
    });

    if (!borrowedBook) {
      return res.status(404).json({
        success: false,
        message: "Borrowed book not found",
      });
    }

    const result = await borrowedBooksCollection.deleteOne({
      _id: new ObjectId(borrowId),
    });

    if (result.deletedCount === 0) {
      return res.status(404).json({
        success: false,
        message: "Book could not be returned",
      });
    }

    await booksCollection.updateOne(
      { _id: borrowedBook.bookId },
      { $inc: { totalCopies: 1 } }
    );

    res.json({
      success: true,
      message: "Book returned successfully",
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to return book" });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
