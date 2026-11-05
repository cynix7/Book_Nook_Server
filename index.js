import express from 'express';
import { MongoClient } from 'mongodb';
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

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
