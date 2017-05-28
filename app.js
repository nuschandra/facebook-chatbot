var express=require('express')
var app=express()
var https=require('https')
var port=3000
var fs=require('fs')

app.get('/webhook',function(req,res){
	if (req.query['hub.mode'] === 'subscribe' &&
		req.query['hub.verify_token'] === 'this_is_fun') {
		console.log("Validating webhook");
		res.status(200).send(req.query['hub.challenge']);
	} else {
		console.error("Failed validation. Make sure the validation tokens match.");
    	res.sendStatus(403);          
  	}  
  	res.send('Hello World!')
})


app.listen(process.env.PORT,function(){
	console.log('Example app listening on port 3000!')
})