$(function () {
    var url = "http://localhost:8080/chat";
    var loggedInUser = $('#username').html();
    var socket = io.connect('', {query: 'data='+loggedInUser});
    
    //Function displays all the logged in users in the ul with id: online-users
    socket.on("updateOnlineUsers", function(data){ 
        //Remove duplicate usernames from the data
        var arr = [];
        for(i=0; i<data.length; i++){
          if(arr.indexOf(data[i]) == -1){
            arr.push(data[i])
          }
        }
        
        //Generate string of online users
        var temp = "";
        for(i = 0; i < arr.length; i++){
            temp = temp + '<li>' + '<b>' + arr[i] + '</b>' + '</li>';
        }
        $("#online-users").html(temp);
    });

    //Function submits the message to app.js
    $('form').submit(function(){
        var message = $('#message-input').val();

        //Ensure message string is not an empty string
        if(message != ''){
            socket.emit('chat', message);
            $('#message-input').val('');
        }
        
        return false;
    });

    //Function clears the message log
    socket.on('clear', function(){
        $('#messages').empty();
    });
  
    //Function displays the message in the ul with id: messages
    socket.on('chat', function(data){
        //If message belongs to loggedInUser, bold and italic
        if(data.user == loggedInUser){
            $('#messages').append('<li>' + "<b><i>"  + data.msg + "</i></b>" + '</li>');
        }
        //Else, print it normally
        else{
            $('#messages').append('<li>' + data.msg + '</li>');
        }

        //Scroll the chat up to see the new message
        $('#chat-column').scrollTop($('#chat-column').scrollTop() + $('#chat-column').height());
    });
});
