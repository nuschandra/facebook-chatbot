var express=require('express')
var app=express()
var https=require('https')
var port=3000
var fs=require('fs')

app.get('/webhook',function(req,res){
	res.send('Hello World!')
})


app.listen(process.env.PORT,function(){
	console.log('Example app listening on port 3000!')
})