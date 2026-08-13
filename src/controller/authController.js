import { prisma } from "../config/db.connect.js"
import bcrypt from "bcrypt"
import genrateToken from "../utils/generateToken.js"
const register = async (req, res) => {
    try {
        const { name, email, password } = req.body
        // check if user already exists

        const userExist = await prisma.user.findUnique({ where: { email: email } })
        if (userExist) {
            return res.status(400).json({ message: 'User already exists' })
        }

        // hash password
        const salt = await bcrypt.genSalt(10)
        const hashedPassword = await bcrypt.hash(password, salt)
        // create new user
        const user = await prisma.user.create({
            data: { name, email, password: hashedPassword }
        })

        // generate jwt token
        const token = genrateToken(user.id, res)

        // return response
        res.status(201).json({
            success: true,
            statusCode: 201,
            message: 'User registered successfully',
            user,
            token
        })


    } catch (error) {
        console.log("Error during registration", error)
        res.status(500).json({ message: 'Internal server error' })
    }
}


const login = async (req, res) => {
    try {
        const { email, password } = req.body
        if (!email || !password) {
            return res.status(400).json({ message: 'Please provide email and password' })
        }

        //  checke the user is exists or not
        const userExist = await prisma.user.findUnique({ where: { email: email } })
        if (!userExist) {
            return res.status(404).json({ message: 'User not found' })
        }

        //compare password
        const isPasswordValid = await bcrypt.compare(password, userExist.password)
        if (!isPasswordValid) {
            return res.status(401).json({ message: 'Invalid password' })
        }
        // generate jwt token
        const token = genrateToken(userExist.id,res)
        //return response
        res.status(200).json({
            success: true,
            statusCode: 200,
            message: 'User logged in successfully',
            user: userExist,
            token
        })

    } catch (error) {
        console.log('Error during login', error)
        res.status(500).json({ message: 'Internal server error' })
    }
}

// logOut
const LogOut=async(req,res)=>{
    try {
        res.clearCookie('jwt','',{
            httpOnly:true,
            sameSite:'strict',
            secure:process.env.NODE_ENV !== 'development',
            expires:new Date(0)
        })
        res.status(200).json({ message: 'User logged out successfully' })
    } catch (error) {
        console.log('Error during logout', error)
        res.status(500).json({ message: 'Internal server error' })
    }
}

export { register, login,LogOut }