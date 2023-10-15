const express = require("express");
const app = express();
const port = process.env.PORT || 5000;
require("dotenv").config();
const cors = require("cors");
const jwt = require("jsonwebtoken");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

//middle war
app.use(cors());
app.use(express.json());
// jwt veriry
const verifyJWT = (req, res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization) {
    return res
      .status(401)
      .send({ error: true, message: "unauthorization access token" });
  }
  const token = authorization.split(" ")[1];
  jwt.verify(token, process.env.TOEKN_ACCESS, (error, decoded) => {
    if (error) {
      return res.status(403).send({ error: true, message: "user not valid" });
    }
    req.decoded = decoded;
    next();
  });
};

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
    const paymentCollection = client.db("Restaurant").collection("payments");

    // jwt token secret post api
    app.post("/jwt", (req, res) => {
      const user = req.body;
      const result = jwt.sign(user, process.env.TOEKN_ACCESS, {
        expiresIn: "3h",
      });
      res.send(result);
      return;
    });

    //verify user admin routes
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      if (user?.role !== "admin") {
        return res.status(403).send({ error: true, message: "forbidden" });
      }
      next();
    };
    // user related api
    app.post("/users", async (req, res) => {
      const user = req.body;
      console.log("New user collaboration", user);
      const query = { email: user.email };
      const existingUser = await usersCollection.findOne(query);
      if (existingUser) {
        return res.send({ message: "user already exist" });
      }
      // Assuming usersCollection is a MongoDB collection.
      const result = await usersCollection.insertOne(user);
      res.send(result);
    });

    // user get api
    app.get("/users", verifyJWT, verifyAdmin, async (req, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result);
    });

    // user admin api
    app.get("/users/admin/:email", verifyJWT, async (req, res) => {
      const email = req.params.email;
      if (req.decoded.email !== email) {
        res.send({ admin: false });
      }
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      const result = { admin: user?.role === "admin" };
      res.send(result);
    });

    //user update or make admin api
    app.patch("/users/admin/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          role: "admin",
        },
      };
      const result = await usersCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    // console.log("collection", menuCollection);
    app.get("/menu", async (req, res) => {
      const result = await menuCollection.find().toArray();
      res.send(result);
    });
    // menu item add api
    app.post("/menu", verifyJWT, verifyAdmin, async (req, res) => {
      const newItem = req.body;
      const result = await menuCollection.insertOne(newItem);
      res.send(result);
    });
    // menu items delete api
    app.delete("/menu/:id", verifyJWT, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await menuCollection.deleteOne(query);
      res.send(result);
    });
    // client review get api for client
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
    app.get("/carts", verifyJWT, async (req, res) => {
      const email = req.query.email;
      console.log("carts", email);
      if (!email) {
        res.send([]);
      }

      const decodedEmail = req.decoded.email;
      if (email !== decodedEmail) {
        return res
          .status(403)
          .send({ error: true, message: "forbidden access user" });
      }

      const query = { email: email };
      const result = await cartsCollection.find(query).toArray();
      res.send(result);
    });
    //cart data deleted function api
    app.delete("/carts/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await cartsCollection.deleteOne(query);
      res.send(result);
    });

    // payment card intent
    app.post("/create-payment-intent", verifyJWT, async (req, res) => {
      // const body = req.body;
      const { price } = req.body;
      const amount = price * 100;
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ["card"],
      });

      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });
    // admin dashboard document stats get api
    app.get("/admin-stats",verifyJWT, verifyAdmin, async (req, res) => {

      const users = await usersCollection.estimatedDocumentCount();
      const products = await menuCollection.estimatedDocumentCount();
      const orders = await cartsCollection.estimatedDocumentCount();
      const payments = await paymentCollection.find().toArray();
      const revenue = payments.reduce((sum, payment)=>sum + payment.price, 0);

      res.send({
        users,
        products,
        orders,
        revenue
      })
    });
    // payment related api
    app.post("/payments", async (req, res) => {
      const payment = req.body;
      const insertResult = await paymentCollection.insertOne(payment);

      const query = {
        _id: { $in: payment.cartItems.map((id) => new ObjectId(id)) },
      };
      const deleteResult = await cartsCollection.deleteMany(query);

      res.send({ insertResult, deleteResult });
    });
    // hello

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
