const User = require("../models/users");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const dotenv = require("dotenv").config();

const register = async (req, res) => {
    const {name, email, password} = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({name, email, password: hashedPassword});
    res.status(201).json({user, message: "You are signed in"});
    console.log(user);
}

const login = async (req, res) => {
    const {email, password} = req.body;
    const user = await User.findOne({email});
    if (!user) {
        return res.status(401).json({message: "Invalid credentials"});
    }
    const isPasswordCorrect = await bcrypt.compare(password, user.password);
    if (!isPasswordCorrect) {
        return res.status(401).json({message: "Invalid credentials"});
    }
    const token = jwt.sign({id: user._id}, process.env.JWT_SECRET, {expiresIn: "7d"});
    res.status(200).json({token, message: "Login Successful", user});
}

module.exports = {register, login};