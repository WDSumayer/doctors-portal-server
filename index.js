const express = require ('express')
const app = express();
const { MongoClient, ServerApiVersion, CURSOR_FLAGS, ObjectId } = require('mongodb');
const jwt = require('jsonwebtoken')
const cors = require('cors')
require('dotenv').config()
const port = process.env.PORT || 5000;


app.use(cors())
app.use(express.json())



const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.nrkuqgj.mongodb.net/?retryWrites=true&w=majority`;
console.log(uri)
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

function verifyJWT (req, res, next) {
    const authHeader = req.headers.authorization
    if(!authHeader){
        return res.status(401).send('unauthorized access')
    }
    const token = authHeader.split(' ')[1]
    jwt.verify(token, process.env.SECRET_TOKEN, function(err, decoded) {
        if(err){
            return res.status(403).send({message: 'fobidden access'})
        }
        req.decoded = decoded
        next()
    })
}



async function run() {
    try{
        const appointmentOptionCollection = client.db('doctorsPortal').collection('appointmentOptions')
        const bookingsCollection = client.db('doctorsPortal').collection('bookings')
        const usersCollection = client.db('doctorsPortal').collection('users')
        const doctorsCollection = client.db('doctorsPortal').collection('doctors')
        const doctorsCollectio = client.db('doctorsPortal').collection('doctor')

        const verifyAdmin = async(req, res, next) => {
            const decodedEmail = req.decoded.email
            const query = {email: decodedEmail}
            console.log(decodedEmail)
            const user = await usersCollection.findOne(query)
            if(user?.role !== "admin"){
                return res.status(403).send({message: 'forbidden access'})
            }
            next()
        }
        
        app.get('/appointmentOptions', async(req, res) => {
            const date = req.query.date
            const query = {}
            const cursor = appointmentOptionCollection.find(query)
            const appointmentOptions = await cursor.toArray()
            const bookingQuery = {appointmentDate: date}
            const bookedOptions = await bookingsCollection.find(bookingQuery).toArray()
            appointmentOptions.forEach(option => {
                const bookedOption = bookedOptions.filter(booked => booked.treatment === option.name)
                const bookedSlots = bookedOption.map(bookslot => bookslot.slot)

              
                const remainingSlots = option.slots.filter(apntSlot => !bookedSlots.includes(apntSlot))
                option.slots = remainingSlots
            })

            res.send(appointmentOptions)
        })
        app.get('/specialties', async(req, res) => {
            const query = {}
            const specialties = await appointmentOptionCollection.find(query).project({name: 1}).toArray()
            res.send(specialties)
        })
        app.get('/bookings', verifyJWT, async(req, res) => {
            const email = req.query.email
           
            const query = {
                email: email
            }
            const decodedEmail = req.decoded.email
            if(email !== decodedEmail){
                return res.status(403).send({message: 'forbidden access'})
            }
            const bookings = await bookingsCollection.find(query).toArray()
            res.send(bookings)
        })

        app.get('/jwt', async(req, res) => {
            const email = req.query.email;
            const query = {email: email}
            const user = await usersCollection.findOne(query)
            if(user){
                const token = jwt.sign({email}, process.env.SECRET_TOKEN, {expiresIn: '1h'})
                return res.send({accessToken: token})
            }
            res.status(403).send({accessToken: ''})
        })

        app.get('/users',verifyJWT,verifyAdmin, async(req, res) => {
            const query = {}
            const users = await usersCollection.find(query).toArray()
            res.send(users)
        })

        app.get('/users/admin/:email',  async(req, res) => {
            const email = req.params.email
            // const decodedEmail = req.decoded.email;
            // if(decodedEmail !== email){
            //     return  res.status(403).send({message: 'forbidden access'})
            // }
            const query = {email}
            const user = await usersCollection.findOne(query)
            res.send({isAdmin: user?.role === 'admin'})
        })

        app.get('/doctors',verifyJWT,verifyAdmin, async(req, res) => {
            const query = {}
            const doctors = await doctorsCollection.find(query).toArray()
            res.send(doctors)
        })


        app.put('/users/admin/:id', verifyJWT,verifyAdmin, async(req, res) => {

            



            const id = req.params.id
            const filter = {_id: ObjectId(id)}
            const options = { upsert: true } 
            const updateDoc = {
                $set: {
                    role: 'admin'
                }
            }
            const result = await usersCollection.updateOne(filter, updateDoc, options)
            res.send(result)
        })
        app.post('/bookings', async(req, res) => {
            const booking = req.body

            const query = {
                email: booking.email,
                appointmentDate: booking.appointmentDate,
                treatment: booking.treatment
            }
            const alreadyBookeds = await bookingsCollection.find(query).toArray()
            if(alreadyBookeds.length){
                const message = `you have already booked on date ${booking.appointmentDate}`
                return res.send({acknowledged: false, message})
            }

            const result = await bookingsCollection.insertOne(booking)
            res.send(result)
        })
        
        app.post('/users', async(req, res) => {
            const user = req.body;
            const result = await usersCollection.insertOne(user)
            res.send(result)
        })
        app.post('/doctors',verifyJWT,verifyAdmin, async(req, res) => {
            const doctor = req.body;
            const result = await doctorsCollection.insertOne(doctor)
            res.send(result)
        })
        app.delete('/doctors/:id',verifyJWT,verifyAdmin, async(req, res) => {
            const id = req.params.id;
            const filter = {_id: ObjectId(id)}
            const doctor = await doctorsCollection.deleteOne(filter)
            res.send(doctor)
        })
    }
    finally{

    }
}
run().catch(error => console.log(error))





app.get('/', (req, res) => {
    res.send('doctors portal in running')
})

app.listen(port, () => {
    console.log('the server is running on ', port)
})