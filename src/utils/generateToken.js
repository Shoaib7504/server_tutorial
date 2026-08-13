import jwt from "jsonwebtoken";

const genrateToken = (userId,res) => {
    const payload = { id: userId }

    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '7d' })

    res.cookie("jwt",token,{
        maxAge:7*24*60*60*1000,
        httpOnly:true,
        sameSite:'strict',
        secure:process.env.NODE_ENV !== 'development'
    })
    return token
}

export default genrateToken 