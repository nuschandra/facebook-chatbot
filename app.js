var express=require('express');
var bodyParser=require('body-parser');
var app=express();
var https=require('https');
var request=require('request');
var port=3000;
var fs=require('fs');
var moment=require('moment');
var config=require('config');
require('moment/locale/en-gb')

app.use(bodyParser.json());

app.get('/',function(req,res){
	if (req.query['hub.mode'] === 'subscribe' &&
		req.query['hub.verify_token'] === 'this_is_fun') {
		console.log("Validating webhook");
		res.status(200).send(req.query['hub.challenge']);
	} else {
		console.error("Failed validation. Make sure the validation tokens match.");
    	res.sendStatus(403);          
  	}  
  	res.send('Hello World!');
});

app.post('/webhook',function(req,res){
	var data=req.body;
	if (data.object === 'page'){

		data.entry.forEach(function(entry){
			var pageID=entry.id;
			var timeOfEvent=entry.time;

			entry.messaging.forEach(function(event){
				if(event.message){
					receivedMessage(event);
				}else if (event.postback) {
					receivedPostback(event);
				}else{
					console.log("Webhook received unknown event:",event);
				}
			});
		});
		res.sendStatus(200);
	}
});

function receivedMessage(event){
	var senderID=event.sender.id;
	var recipientID=event.recipient.id;
	var timeOfMessage=event.timestamp;
	var message=event.message;

	console.log("Received message from %d user and %d page at %d time",senderID,recipientID,
		timeOfMessage);

	console.log(JSON.stringify(message));

	var messageId=message.mid;
	var messageText=message.text;
	var messageAttachments=message.attachments;

	console.log(messageId,message.text,message.attachments);
	if(messageText){
		switch(messageText){
			case 'generic':
				sendGenericMessage(senderID);
				break;

			default:
				sendTextMessage(senderID,messageText);
		}
	}else if(messageAttachments){
		sendTextMessage(senderID,"Message with attachments received");
	}
}

function sendGenericMessage(payload,recipientID){
	getCurrentMatches(payload,function(allCurrentMatches){
		var noOfMatches=allCurrentMatches.length;
		var arraySlices=1;
		var matchList=[];
		console.log(allCurrentMatches.length)
		if(allCurrentMatches.length>10){
			arraySlices=Math.ceil(noOfMatches/10);
		}
		var chunks=10;
		for (var i = 0; i < (arraySlices*10); i+=chunks) {
			matchList=allCurrentMatches.slice(i,i+chunks);
			
			console.log(allCurrentMatches);
			console.log(matchList);
			var matchElements=[];
			matchList.some(function(match,index){
				var matchObject={};
				var teamOne=match.TEAM_1;
				var teamTwo=match.TEAM_2;
				if(match.TEAM_1.indexOf(' Women')!==-1){
					match.TEAM_1=match.TEAM_1.replace(' Women','');
				}
				if(match.TEAM_2.indexOf(' Women')!==-1){
					match.TEAM_2=match.TEAM_2.replace(' Women','');
				}
				matchObject.title=teamOne+" vs "+teamTwo;
				var matchDetails=match.MATCH_DETAILS;
				var matchStatus=match.MATCH_STATUS;
				matchObject.subtitle=matchDetails;
				if (matchStatus=='None'){
					matchObject.subtitle=matchDetails+"\n"+'N/A';
				}
				else{
					matchObject.subtitle=matchDetails+"\n"+matchStatus;
				}
				if (payload==='INTERNATIONALS' || payload==='WOMEN'){
					var title=match.TEAM_1+" vs "+match.TEAM_2;
					matchObject.image_url=config.get('INTERNATIONALS'+"."+title);
				}
				else if (payload==='DOMESTIC'){
					matchObject.image_url=config.get(payload+"."+match.COUNTRY_NAME);
				}
				else{
					matchObject.image_url=config.get(payload);
				}
				var buttons=[];
				var buttonObject={};
				buttonObject.type="web_url";
				buttonObject.title="Get Scores";
				buttonObject.url="https://cricket-live-scores.herokuapp.com/#/scores/"+match.MATCH_ID;
				buttonObject.webview_height_ratio="compact";
				buttons.push(buttonObject);
				matchObject.buttons=buttons;
				matchElements.push(matchObject);
			});
			//console.log(matchElements);
			if(matchElements.length>0){
				var messageData={
					recipient:{
						id:recipientID
					},
					message:{
						attachment:{
							type:"template",
							payload:{
								template_type:"generic",
								elements:matchElements
							}
						}
					}
				};
				callSendAPI(messageData);
			}
			else{
				var messageData={
					recipient:{
						id:recipientID
					},
					message:{
						text:"There are no ongoing matches!"
					}
				};
				callSendAPI(messageData);
			}
		}		
	})
	
}

function sendReply(recipientID,messageText){
	var messageData={
			recipient:{
				id:recipientID
			},
			message:{
				text:messageText
			}
	};
	callSendAPI(messageData);
}
function sendTextMessage(recipientID,messageText){
	getUpcomingMatches(function(message){
		var messageData={
			recipient:{
				id:recipientID
			},
			message:{
				text:message
			}
		};
		callSendAPI(messageData);
	});
}

function getUpcomingMatches(callback){
	var upcomingMatchesData={
		apikey:"qMdsykxRTkft5pvwqdaqOI8D6Sm2"
	};
	request({
		uri:'http://cricapi.com/api/matches',
		method:'POST',
		json:upcomingMatchesData
	},function(error,response,body){
		//console.log(body.matches[0].unique_id);
		if(!error && response.statusCode==200){
			var teamOne=body.matches[0]["team-1"];
			var teamTwo=body.matches[0]["team-2"];
			callback(body.matches);
			//console.log(teamOne);
			//console.log(teamTwo);
			console.log("Successfully retrieved upcoming matches");
		}
		else{
			console.error("Unable to retrieve list of upcoming matches");
			console.error(response);
			console.error(error);
		}
	});
}
//&& match.unique_id.indexOf('will generate') < 0
function getCurrentMatches(payload,callback){
	request({
		uri:'https://cricket-api-info.herokuapp.com/currentMatches',
		qs:{matchType:payload},
		method:'GET',
		json:true
	},function(error,response,body){
		//console.log(body.matches[0].unique_id);
		if(!error && response.statusCode==200){
			var matches=body;
			//console.log("TODAY MATCHES - ");
			//console.log(matches);
			callback(matches);
		}
		else{
			console.error("Unable to retrieve current matches");
			console.error(response);
			console.error(error);
		}
	});
}

function getUniqueId(callback,matchesWithNoId){
	getUpcomingMatches(function(matches){
		matchesWithNoId.forEach(function(match){
			//var versusString=match.name.indexOf(' v ');
			//var atString=match.name.indexOf(' at ');
			//var teamOne=match.name.slice(0,versusString);
			//var teamTwo=match.name.slice(versusString+3,atString);
			var teamOne,teamTwo;
			getMatchDetails(function(matchDetails){
				teamOne=matchDetails.teamOne;
				teamTwo=matchDetails.teamTwo;
				console.log(teamOne,teamTwo);
			},match);
			var filterMatches=matches.filter(function(match){
				return ((match["team-1"]===teamOne || match["team-1"]===teamTwo) && (match["team-2"]===teamOne || match["team-2"]===teamTwo));
			});
			if(filterMatches.length>0){
				match.unique_id=filterMatches[0].unique_id;
				match.matchStarted=filterMatches[0].matchStarted;
			}
			else{
				match.matchStarted=false;
			}
		});
		callback(matchesWithNoId);
	});
	
}

function getMatchDetails(callback,match){
	var matchDetails={};
	var versusString=match.name.indexOf(' v ');
	var atString=match.name.indexOf(' at ');
	var commaString=match.name.indexOf(', ');
	matchDetails.teamOne=match.name.slice(0,versusString);
	matchDetails.teamTwo=match.name.slice(versusString+3,atString);
	matchDetails.matchTitle=match.name.slice(0,atString);
	matchDetails.venue=match.name.slice(atString+4,commaString);
	matchDetails.seriesInformation=match.name.slice(commaString+2,match.name.length);
	console.log(matchDetails);
	console.log(matchDetails[2]);
	callback(matchDetails);
}

function callSendAPI(messageData){
	request({
		uri:'https://graph.facebook.com/v2.6/me/messages',
		qs:{access_token:'EAAShs2WgQs4BAJiOZA5J3diViRvU9Vp5GZB4JGzegEzUIAllQasWb78MXJc5CNCa5YqoA7WEUiaUrGvTS8htNlNPOFjYAxZB0g7oUGy49HEruq1mdxPPdBZBJhnBE270pv1hDCBZC4NLZBmASTMdTUdnmf7YCd5s3HZBh1Xc6aqGQZDZD'},
		method:'POST',
		json:messageData
	},function(error,response,body){
		console.log(body);
		if(!error && response.statusCode==200){
			var recipientID=body.recipient_id;
			var messageID=body.message_id;
			console.log("Successfully sent message with id %s to recipient %s",messageID,recipientID);
		}
		else{
			console.error("Unable to send message");
			console.error(response);
			console.error(error);
		}
	});
}

function receivedPostback(event){
	var senderID=event.sender.id;
	var recipientID=event.recipient.id;
	var timeOfPostback=event.timestamp;

	var payload=event.postback.payload;
	console.log("Received postback for user %d and page %d with payload '%s'",senderID,recipientID,payload);
	if(payload==='GET_STARTED_PAYLOAD'){
		sendReply(senderID,"Welcome to TestSports! Select an option from the below menu.");
	}
	if(payload==='INTERNATIONALS'){
		sendGenericMessage(payload,senderID);
	}
	if(payload==='DOMESTIC'){
		sendGenericMessage(payload,senderID);
	}
	if(payload==='WOMEN'){
		sendGenericMessage(payload,senderID);
	}
	if(payload==='OTHERS'){
		sendGenericMessage(payload,senderID);
	}
}

app.listen(process.env.PORT,function(){
	console.log('Example app listening on port 3000!')
});