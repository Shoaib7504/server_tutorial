import express from 'express';
import { login,LogOut, register } from '../controller/authController.js'

const router = express.Router();

router.post('/register',register)

router.post('/login',login)

router.post('/logout',LogOut)


export default router
