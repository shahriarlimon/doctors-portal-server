const express = require("express");
const cors = require("cors");
require("dotenv").config();
const jwt = require("jsonwebtoken");
const { MongoClient, ServerApiVersion } = require("mongodb");
const app = express();
const port = process.env.PORT || 5000;
/* middleware  */
app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.rpui9.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: ServerApiVersion.v1,
});
function verifyJWT(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).send({ message: "Unauthorized access" });
  }
  const token = authHeader.split(" ")[1];
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRATE, function (err, decoded) {
    if (err) {
      return res.status(403).send({ message: "Forbidden access" });
    }
    req.decoded = decoded;
    next();
  });
}
async function run() {
  try {
    await client.connect();
    const treatmentCollection = client
      .db("doctors_portal")
      .collection("treatments");
    const bookingCollection = client
      .db("doctors_portal")
      .collection("bookings");
    const doctorCollection = client.db("doctors_portal").collection("doctors");
    const verifyAdmin = async (req, res, next) => {
      const requester = req.decoded.email;
      const requesterAccount = await userCollection.findOne({
        email: requester,
      });
      if (requesterAccount.role === "admin") {
        next();
      } else {
        res.status(403).send({ message: "forbidden access" });
      }
    };
    const userCollection = client.db("doctors_portal").collection("users");
    app.get("/treatments", async (req, res) => {
      const query = {};
      const result = await treatmentCollection
        .find(query)
        .project({ name: 1 })
        .toArray();
      res.send(result);
    });

    app.get("/users", verifyJWT, async (req, res) => {
      const users = await userCollection.find().toArray();
      res.send(users);
    });
    app.get("/admin/:email", async (req, res) => {
      const email = req.params.email;
      const user = await userCollection.findOne({ email: email });
      const isAdmin = user.role === "admin";
      res.send({ admin: isAdmin });
    });
    app.put("/user/admin/:email", verifyJWT, verifyAdmin, async (req, res) => {
      const email = req.params.email;

      const filter = { email: email };
      const updateDoc = {
        $set: { role: "admin" },
      };
      const result = await userCollection.updateOne(filter, updateDoc);
      res.send(result);
    });
    app.put("/user/:email", async (req, res) => {
      const email = req.params.email;
      const user = req.body;
      const filter = { email: email };
      const options = { upsert: true };
      const updateDoc = {
        $set: user,
      };
      const result = await userCollection.updateOne(filter, updateDoc, options);
      const token = jwt.sign(
        { email: email },
        process.env.ACCESS_TOKEN_SECRATE,
        { expiresIn: "1h" }
      );
      res.send({ result, token });
    });
    app.get("/booking", verifyJWT, async (req, res) => {
      const patient = req.query.patient;
      const decodedEmail = req.decoded.email;
      if (decodedEmail === patient) {
        const query = { patient: patient };
        const bookings = await bookingCollection.find(query).toArray();
        return res.send(bookings);
      } else {
        return res.status(403).send({ message: "Forbidden access" });
      }
    });
    app.post("/booking", async (req, res) => {
      const booking = req.body;
      const query = {
        treatment: booking.treatment,
        date: booking.date,
        patient: booking.patient,
      };
      const exists = await bookingCollection.findOne(query);
      if (exists) {
        return res.send({ success: false, booking: exists });
      }
      const result = await bookingCollection.insertOne(booking);
      res.send({ success: true, result });
    });
    app.get("/available", async (req, res) => {
      const date = req.query.date;
      /* step:1 - get all the treatments */ const treatments =
        await treatmentCollection.find().toArray();
      /* step:2 - get the booking of the day */ const query = { date: date };
      const bookings = await bookingCollection.find(query).toArray();
      /* for each treatment */
      treatments.forEach((treatment) => {
        const bookingTreatments = bookings.filter(
          (book) => book.treatment === treatment.name
        );
        const bookedSlots = bookingTreatments.map((book) => book.slot);
        const availalble = treatment.slots.filter(
          (slot) => !bookedSlots.includes(slot)
        );
        treatment.slots = availalble;
      });

      res.send(treatments);
    });
    app.post("/doctors", verifyJWT, verifyAdmin, async (req, res) => {
      const doctor = req.body;
      const result = await doctorCollection.insertOne(doctor);
      res.send(result);
    });
    app.delete("/doctor/:email", verifyJWT, verifyAdmin, async (req, res) => {
      const email = req.params.email;
      const filter = {email:email}
      const result = await doctorCollection.deleteOne(filter);
      res.send(result);
    });
    app.get('/doctors',verifyJWT,verifyAdmin,async(req,res)=>{
      const result = await doctorCollection.find().toArray();
      res.send(result)
    })
  } finally {
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Hello from doctors portal!");
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
