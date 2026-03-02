const express = require('express');
const { engine } = require('express-handlebars');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { Kafka } = require('kafkajs');

const app = express();
const PORT = process.env.PORT || 8080;

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static('public'));

// Handlebars template engine configuration
app.engine('hbs', engine({
  extname: 'hbs',
  defaultLayout: 'main',
  layoutsDir: path.join(__dirname, 'views/layouts'),
  partialsDir: path.join(__dirname, 'views/partials'),
  helpers: {
    json: function(context) {
      return JSON.stringify(context);
    },
    formatDate: function(date) {
      return new Date(date).toLocaleString();
    }
  }
}));
app.set('view engine', 'hbs');
app.set('views', path.join(__dirname, 'views'));

// Kafka configuration with environment variables
const KAFKA_BROKER = process.env.KAFKA_BROKER || 'localhost:9092';
const KAFKA_SECURITY_PROTOCOL = process.env.KAFKA_SECURITY_PROTOCOL;
const KAFKA_SASL_MECHANISM = process.env.KAFKA_SASL_MECHANISM;
const KAFKA_SASL_USERNAME = process.env.KAFKA_SASL_USERNAME;
const KAFKA_SASL_PASSWORD = process.env.KAFKA_SASL_PASSWORD;
const KAFKA_INTAKE_TOPIC = process.env.KAFKA_INTAKE_TOPIC || 'intake';

/**
 * @type {import('kafkajs').KafkaConfig}
 */
const kafkaConfig = {
  clientId: 'customer-support-intake',
  brokers: [KAFKA_BROKER]
};

// Add SSL configuration if security protocol is specified
if (KAFKA_SECURITY_PROTOCOL) {
  kafkaConfig.ssl = KAFKA_SECURITY_PROTOCOL === 'SSL' || KAFKA_SECURITY_PROTOCOL === 'SASL_SSL';
}

// Add SASL configuration if authentication is specified
if (KAFKA_SASL_MECHANISM && KAFKA_SASL_USERNAME && KAFKA_SASL_PASSWORD) {
  kafkaConfig.sasl = {
    mechanism: KAFKA_SASL_MECHANISM, // e.g., 'plain', 'scram-sha-256', 'scram-sha-512'
    username: KAFKA_SASL_USERNAME,
    password: KAFKA_SASL_PASSWORD
  };
}

const kafka = new Kafka(kafkaConfig);

const producer = kafka.producer();

// Load intake files
function loadIntakeFiles() {
  const intakeDir = path.join(__dirname, 'intake');
  const files = fs.readdirSync(intakeDir).filter(file => file.endsWith('.txt'));
  
  const intakeFiles = {};
  
  files.forEach(file => {
    const filePath = path.join(intakeDir, file);
    const content = fs.readFileSync(filePath, 'utf8').trim();
    const displayName = file.replace('.txt', '').replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    
    intakeFiles[file] = {
      filename: file,
      displayName: displayName,
      content: content
    };
  });
  
  return intakeFiles;
}

app.get('/', (req, res) => {
  const intakeFiles = loadIntakeFiles();
  
  res.render('index', {
    title: 'Message Intake',
    subtitle: 'Select and submit customer support messages to Kafka',
    intakeFiles: intakeFiles,
    intakeFilesJson: JSON.stringify(intakeFiles),
    kafkaBroker: KAFKA_BROKER,
    kafkaTopic: KAFKA_INTAKE_TOPIC
  });
});

app.post('/submit', async (req, res) => {
  try {
    const { selectedFile, content } = req.body;
    
    if (!selectedFile || !content) {
      return res.status(400).send('Missing required fields');
    }
    
    // Create Kafka message based on the format
    const messageId = uuidv4().replace(/-/g, '');
    const timestamp = new Date().toISOString().replace('T', ' ').replace('Z', '');
    
    const kafkaMessage = {
      id: messageId,
      content: content,
      timestamp: timestamp,
      structured: null,
      route: null,
      support: null,
      website: null,
      finance: null,
      comment: null,
      error: []
    };
    
    // Send to Kafka
    await producer.connect();
    await producer.send({
      topic: KAFKA_INTAKE_TOPIC,
      messages: [{
        key: messageId,
        value: JSON.stringify(kafkaMessage)
      }]
    });
    await producer.disconnect();
    
    // Redirect to success page
    res.redirect(`/success?id=${messageId}&file=${encodeURIComponent(selectedFile)}`);
    
  } catch (error) {
    console.error('Error submitting message:', error);
    res.status(500).render('error', {
      title: 'Error',
      errorMessage: error.message,
      kafkaBroker: KAFKA_BROKER,
      kafkaTopic: KAFKA_INTAKE_TOPIC,
      kafkaSecurityProtocol: KAFKA_SECURITY_PROTOCOL
    });
  }
});

app.get('/success', (req, res) => {
  const { id, file } = req.query;
  
  res.render('success', {
    title: 'Success',
    messageId: id,
    fileName: decodeURIComponent(file || 'Unknown'),
    timestamp: new Date().toLocaleString(),
    kafkaBroker: KAFKA_BROKER,
    kafkaTopic: KAFKA_INTAKE_TOPIC
  });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Kafka Configuration:`);
  console.log(`  Broker: ${KAFKA_BROKER}`);
  console.log(`  Topic: ${KAFKA_INTAKE_TOPIC}`);
  if (KAFKA_SECURITY_PROTOCOL) {
    console.log(`  Security Protocol: ${KAFKA_SECURITY_PROTOCOL}`);
  }
  if (KAFKA_SASL_MECHANISM) {
    console.log(`  SASL Mechanism: ${KAFKA_SASL_MECHANISM}`);
    console.log(`  SASL Username: ${KAFKA_SASL_USERNAME}`);
  }
});

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down gracefully...');
  await producer.disconnect();
  process.exit(0);
});
