const express = require("express");
const app = express();
const port = process.env.PORT || 5000;
require("dotenv").config();
const cors = require("cors");

//middle war
app.use(cors());
app.use(express.json());
// app.use(bodyParser.json());


const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const uri = `mongodb+srv://${process.env.MONGO_USER}:${process.env.MONGO_PASS}@cluster0.dracezw.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    //menu data api built here
    const menuCollection = client.db("Restaurant").collection("menu");
    const reviewsCollection = client.db("Restaurant").collection("reviews");
    const cartsCollection = client.db("Restaurant").collection("carts");
    const usersCollection = client.db("Restaurant").collection("users");
    
    // user related api
    app.post('/users', async (req, res) => {
      
        const user = req.body;
        console.log("New user collaboration", user);
        const query ={ email: user.email}
        const existingUser = await usersCollection.findOne(query);
        if(existingUser){
          return res.send({message:'user already exist'})
        }
        // Assuming usersCollection is a MongoDB collection.
        const result = await usersCollection.insertOne(user);
        res.send(result)
      
    });

    // console.log("collection", menuCollection);
    app.get("/menu", async (req, res) => {
      const result = await menuCollection.find().toArray();
      res.send(result);
    });
    app.get("/reviews", async (req, res) => {
      const result = await reviewsCollection.find().toArray();
      res.send(result);
    });

    //add to cart collection database
    app.post("/carts", async (req, res) => {
      const item = req.body;
      const result = await cartsCollection.insertOne(item);
      res.send(result);
    });
    //api get req for carts data
    app.get("/carts", async (req, res) => {

      const email = req.query.email;
      console.log("carts",email)
      if(!email){
        res.send([])
      }
      const query = {email: email};
      const result = await cartsCollection.find(query).toArray();
      res.send(result)


    });
    //cart data deleted function api
    app.delete('/carts/:id', async(req, res)=>{

      const id = req.params.id;
      const query = {_id: new ObjectId(id)}
      const result = await cartsCollection.deleteOne(query);
      res.send(result)
    })
    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("I am running on ...5000 server for Restaraunts ");
});
app.listen(port, () => {
  console.log(`I am running on here ${port}`);
});
