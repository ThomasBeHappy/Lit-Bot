const Discord = require('discord.js');
const client = new Discord.Client({ fetchAllMembers: false, apiRequestMethod: 'sequential' });
const yt = require('ytdl-core');
const connections = new Map();
const exec = require('child_process').exec;
const tokens = require('./config.json');
const snekfetch = require('snekfetch')
const randomanswer = ['Try again later','My vision says no','my vision says yes!','Better not tel you.','For sure!','your really wanna know the answer?'];

let queue = {};

const commands = {
	'play': (m) => {
		if (queue[m.guild.id] === undefined) return m.channel.sendMessage(`Add some songs to the queue first with ${tokens.prefix}add`);
		if (!m.guild.voiceConnection) return commands.join(m).then(() => commands.play(m));
		if (queue[m.guild.id].playing) return m.channel.sendMessage('Already Playing');
		let dispatcher;
		queue[m.guild.id].playing = true;

		console.log(queue);
		(function play(song) {
			console.log(song);
			if (song === undefined) return m.channel.sendMessage('Queue is empty').then(() => {
				queue[m.guild.id].playing = false;
				m.member.voiceChannel.leave();
			});
			m.channel.sendMessage(`Playing: **${song.title}** as requested by: **${song.requester}**`);
			dispatcher = m.guild.voiceConnection.playStream(yt(song.url, { audioonly: true }), { passes : tokens.passes });
			let collector = m.channel.createCollector(m => m);
			collector.on('message', m => {
				if (m.content.startsWith(tokens.prefix + 'pause')) {
					m.channel.sendMessage('Paused').then(() => {dispatcher.pause();});
				} else if (m.content.startsWith(tokens.prefix + 'resume')){
					m.channel.sendMessage('Resumed').then(() => {dispatcher.resume();});
				} else if (m.content.startsWith(tokens.prefix + 'skip')){
					m.channel.sendMessage('Skipped').then(() => {dispatcher.end();});
				} else if (m.content.startsWith('volume+')){
					if (Math.round(dispatcher.volume*50) >= 100) return m.channel.sendMessage(`Volume: ${Math.round(dispatcher.volume*50)}%`);
					dispatcher.setVolume(Math.min((dispatcher.volume*50 + (2*(m.content.split('+').length-1)))/50,2));
					m.channel.sendMessage(`Volume: ${Math.round(dispatcher.volume*50)}%`);
				} else if (m.content.startsWith('volume-')){
					if (Math.round(dispatcher.volume*50) <= 0) return m.channel.sendMessage(`Volume: ${Math.round(dispatcher.volume*50)}%`);
					dispatcher.setVolume(Math.max((dispatcher.volume*50 - (2*(m.content.split('-').length-1)))/50,0));
					m.channel.sendMessage(`Volume: ${Math.round(dispatcher.volume*50)}%`);
				} else if (m.content.startsWith(tokens.prefix + 'time')){
					m.channel.sendMessage(`time: ${Math.floor(dispatcher.time / 60000)}:${Math.floor((dispatcher.time % 60000)/1000) <10 ? '0'+Math.floor((dispatcher.time % 60000)/1000) : Math.floor((dispatcher.time % 60000)/1000)}`);
				}
			});
			dispatcher.on('end', () => {
				collector.stop();
				play(queue[m.guild.id].songs.shift());
			});
			dispatcher.on('error', (err) => {
				return m.channel.sendMessage('error: ' + err).then(() => {
					collector.stop();
				});
			});
		})
	},
	'join': (m) => {
		return new Promise((resolve, reject) => {
			const voiceChannel = m.member.voiceChannel;
			if (!voiceChannel || voiceChannel.type !== 'voice') return m.reply('I couldn\'t connect to your voice channel...');
			voiceChannel.join().then(connection => resolve(connection)).catch(err => reject(err));
		});
	},
	'add': (m) => {
		let url = m.content.split(' ')[1];
		if (url == '' || url === undefined) return m.channel.sendMessage(`You must add a YouTube video url, or id after ${tokens.prefix}add`);
		yt.getInfo(url, (err, info) => {
			if(err) return m.channel.sendMessage('Invalid YouTube Link: ' + err);
			if (!queue.hasOwnProperty(m.guild.id)) queue[m.guild.id] = {}, queue[m.guild.id].playing = false, queue[m.guild.id].songs = [];
			queue[m.guild.id].songs.push({url: url, title: info.title, requester: m.author.username});
			m.channel.sendMessage(`added **${info.title}** to the queue`);
		});
	},
	'queue': (m) => {
		if (queue[m.guild.id] === undefined) return m.channel.sendMessage(`Add some songs to the queue first with ${tokens.prefix}add`);
		let tosend = [];
		queue[m.guild.id].songs.forEach((song, i) => { tosend.push(`${i+1}. ${song.title} - Requested by: ${song.requester}`);});
		m.channel.sendMessage(`__**${m.guild.name}'s Music Queue:**__ Currently **${tosend.length}** songs queued ${(tosend.length > 15 ? '*[Only next 15 shown]*' : '')}\n\`\`\`${tosend.slice(0,15).join('\n')}\`\`\``);
	},
	'help': (m) => {
		let tosend = ['```Music Commands', tokens.prefix + 'join | Join Voice channel of m sender',	tokens.prefix + 'add | Add a valid youtube link to the queue', tokens.prefix + 'queue | Shows the current queue, up to 15 songs shown.', tokens.prefix + 'play | Play the music queue if already joined to a voice channel', '', 'the following commands only function while the play command is running:'.toUpperCase(), tokens.prefix + 'pause | pauses the music',	tokens.prefix + 'resume | resumes the music', tokens.prefix + 'skip | skips the playing song', tokens.prefix + 'time | Shows the playtime of the song.',	'volume+(+++) | increases volume by 2%/+',	'volume-(---) | decreases volume by 2%/-', '', 'Other commands','lb.getmewater | Gives you water', 'lb.ping | Shows you the speed of the bot normally used for debugging', '```'];
		m.channel.sendMessage(tosend.join('\n'));
	},
	'reboot': (m) => {
		if (m.author.id == tokens.adminID) process.exit(); //Requires a node module like Forever to work.
	}
};


client.on('ready', () => {
  console.log('I am ready!');
  client.user.setGame('Type lb.help for help')
  console.log('Running on ' + client.guilds.size);
  snekfetch.post(`https://discordbots.org/api/bots/${client.user.id}/stats`)
    .set('Authorization', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjIyOTU2MzY3NDM3NTc0OTYzMyIsImlhdCI6MTQ5NzcyODcwOX0.H6z0Yga3YESwqtjkqaWWXz4r3imYR5zWQdOCfUbFnBQ')
    .send({ server_count: client.guilds.size })
    .then(console.log('Updated dbots.org status.'))
    .catch(e => console.warn('dbots.org down spam @oliy'));
});

client.on('message', m => {
  if (!m.guild) return;

  if(m.content === "lb.ping") {
   m.channel.send({embed: {
   color: 3447003,
   author: {
     name: m.author.user,
     icon_url: m.author.avatarURL
   },
   description: "pong!",
   fields: [{
       name: "My ping is:",
       value: "**" + client.ping.toFixed(0) + " ms!**"
     }],
       timestamp: new Date(),
   footer: {
     icon_url: m.author.avatarURL,
     text: m.author.username + " Wants to know my current ping!"
   }
 }
});
 }
  if(m.content === "lb.stats") {
    m.channel.send(`Here are my stats! \n**Servers:** ${client.guilds.size} \n**Channels**: ${client.channels.size} \n**Users** ${client.users.size}`);
  }
	if(m.content.startsWith("lb.8ball")) {
    m.reply('' + randomanswer[Math.floor(Math.random()*randomanswer.length)])
  }

  if (m.content === 'lb.getmewater') {
    console.log(`${m.author.username} did something`);
    m.channel.send('Here is your water!', {file:'water.jpg'} )
  }
  if (m.content.startsWith('#eval') && m.author.id === '229563674375749633') {
    try {
      const com = eval(m.content.split(' ').slice(1).join(' '));
      m.channel.send(`\`\`\`\n${com}\`\`\``);
    } catch (e) {
      console.log(e);
      m.channel.send(`\`\`\`\n${e}\`\`\``);
    }
  }

	if (!m.content.startsWith(tokens.prefix)) return;
	if (commands.hasOwnProperty(m.content.toLowerCase().slice(tokens.prefix.length).split(' ')[0])) commands[m.content.toLowerCase().slice(tokens.prefix.length).split(' ')[0]](m);
});

client.login('MzI1MzM4NTEzMTUzMTk2MDMy.DCv_6w.1Y40IgQa-QjOObo3JOWrmQhUu3Y');
