import express from 'express';
import { MongoClient,ObjectId } from 'mongodb';
import cors from 'cors';
import 'dotenv/config'
  
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

app.get("/book/:id", async (req, res) => {
  try {
    const bookId = req.params;
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

app.post("/add-book", async (req, res) => {
  try {
    const newBook = req.body;
    const result = await booksCollection.insertOne(newBook);
    res.status(201).json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to add book' });
  }
});

app.post("/borrow-book", async (req, res) => {
  try {
    const borrowedBook = req.body;  
    const result = await borrowedBooksCollection.insertOne(borrowedBook);
    res.status(201).json({
  success: true,
  message: "Book borrowed successfully",
});
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to borrow book' });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
