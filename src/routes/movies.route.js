import express from "express";

const router = express.Router();

//get all movies
router.get('/',(req,res)=>{
    res.json({httpMethod:'GET',message:'Movies are here'})
})

//get movie by id
// router.get('/:id',(req,res)=>{
//     res.json({message:`Movie with id ${req.params.id} found`})
// })

//add movie
router.post('/',(req,res)=>{
    res.json({httpMethod:'POST',message:'Movie added',data:req.body})
})

//update movie
router.put('/',(req,res)=>{
    res.json({httpMethod:'PUT',message:'Movie updated',data:req.body})
})

//delete movie
router.delete('/',(req,res)=>{
    res.json({httpMethod:'DELETE',message:'Movie deleted',data:req.body})
})

export default router