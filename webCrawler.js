'use strict'

//Import Express module
var express = require('express');
var app = express();

//Initialize http server
var http = require('http').Server(app);

//Create socket.io client
var io = require('socket.io')(http);

//Import path module
var path = require('path');

//Declare global variables
var pages = [];
var validPages = [];
var invalidPages = []; 
var skippedPages = [];
var debugMode = false;

/**Routes to index.html when a GET request is made to the homepage**/
app.get('/', function (req, res) {
	res.sendFile(path.join(__dirname + '/index.html'));
});

/**Mounts the css stylesheet**/
app.use(express.static(path.join(__dirname, '/css')));

/**Listens for socket.io connection event**/
io.on('connection', function(socket){
	print('a user connected');
	
	/**Listen for 'crawl' event from the client**/
	socket.on('crawl', function(msg){
		print('Begin crawling');
		
		//make sure the global variables are empty
		resetGlobalVariables();	
		
		//check to make sure pages key exists
		if(msg && msg.hasOwnProperty('pages')){
			pages = msg.pages;
			print(pages);
			//get first page (if it exists) to begin crawling and 
			//wait for deferred to be resolved before printing results
			if(pages[0] && pages[0].address){
				crawlPage(pages[0].address)
				.then(function(){
					displayResults();
				});
			}
		}
	});
});

/**Listening on port 8080**/
http.listen(8080, function() {
	//use console.log instead of print function to ensure 
	//the port is always printed to the console
	console.log('WebCrawler listening on port 8080');
});

/**Handles logic to crawl the given page**/
function crawlPage(page){
	print('crawling page ' + page);

	//deferred object to return once the page has been crawled
	var deferred = Promise.defer();
	
	try{
		//check to see if the page is a valid page
		if(isValidPage(page)){
			//check to ensure the page has not been previously visited
			if(!hasBeenVisited(page)){
				//mark page as visited by adding to validPages object
				validPages.push(page);

				//visit page to retrieve the links
				var links = visitPage(page);

				if(links != null && links.length > 0){
					//recursively crawl retrieved links
					for(var index in links){
						print(links[index]);
						crawlPage(links[index]);
					}
				}
			}
		
			//if the page has already been visited add it to the 
			//skippedPages object if it isn't already there
			else if(skippedPages.indexOf(page) == -1){
				skippedPages.push(page);
			}
		}

		//if the page is not a valid page store it in the 
		//invalidPages object if it isn't already there
		else if(invalidPages.indexOf(page) === -1){
			invalidPages.push(page);
		}
		//resolve the promise if the code completes without any errors
        deferred.resolve();
	}
	//reject the promise if an error occurs
	catch(err){
		deferred.reject(err);
	}

	//return the promise once the page has been crawled
	return deferred.promise;	
}

/**Determine whether the given page is valid**/
function isValidPage(page){
	for(var index in pages){
		if(pages[index].address === page){
			print(page + ' is a valid page');
			return true;
		}
	}
	print(page + ' is an invalid page');
	return false;
}

/**Retrieves the links from the given page**/
function visitPage(page){
	for(var index in pages){
		if(pages[index].address === page){
			print('returning links for ' + page);
			return pages[index].links;
		}
	}
	print(page + ' is an invalid page, no links returned');
}

/**Determines if a page has been visited**/
function hasBeenVisited(page){
	return (validPages.indexOf(page) != -1);
}

/**Sends message to server with the results to display**/
function displayResults(){
	print('Success: \n' + validPages.toString());
	print('Skipped: \n' + skippedPages.toString());
	print('Error: \n' + invalidPages.toString());
	
	var msg = {
		'success': validPages,
		'skipped': skippedPages,
		'error': invalidPages
	};
	io.sockets.emit('displayResults', msg);
}

/**Reset global variables to ensure a clean execution each time**/
function resetGlobalVariables(){
	pages = [];
	validPages = [];
	invalidPages = []; 
	skippedPages = [];
}

/**Log to console iff debugMode is true**/
function print(msg, error){
	if(debugMode){
		if(error)
			console.error(msg);
		else
			console.log(msg);
	}
}