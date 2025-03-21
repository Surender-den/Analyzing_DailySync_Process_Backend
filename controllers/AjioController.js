const {Client} = require('pg');
const dotenv = require('dotenv');
const path = require('path');
const { channel } = require('diagnostics_channel');
const { report } = require('process');
const { log } = require('console');
const { type } = require('os');
dotenv.config({path:path.join(__dirname,'..','config','config.env')});

const MAX_RETRIES = 5; // Maximum retry attempts

const AjioController = async () => {
    let client = null;
    let attempts = 0;
     while (attempts < MAX_RETRIES) {
          attempts++;
          console.log(`Attempt ${attempts} to process Ajio Error stats...`);
    try{
        // Database connection setup
        const dbConfig = {
        user: process.env.PG_USER,
        host: process.env.PG_HOST,
        database: process.env.PG_DATABASE,
        password: process.env.PG_PASSWORD,
        port: Number(process.env.PG_PORT),
        ssl: process.env.PG_SSL === 'true' ? { rejectUnauthorized: false } : false,
        connectionTimeoutMillis: 20000,  // 20 seconds
        query_timeout: 20000,            // 20 seconds
          };
      

          client = new Client(dbConfig);
          await client.connect();
      
          const targetChannel = 'Ajio';
      
          // Step 1: Fetch orgid and channel
          const orgChannelQuery = `
            SELECT DISTINCT(org.orgId) AS org_id, org.channel
            FROM "fs-organisations-channels-db" AS org
            JOIN organisation AS i ON org.orgid = i.org_id 
            WHERE org.channel = $1 and org.orgId!=10
              AND isSyncDisabled IS NOT TRUE
              AND (isDisabled != TRUE OR isDisabled IS NULL)
              AND (isDisconnected != TRUE OR isDisconnected IS NULL);
          `;
          const orgChannelResult = await client.query(orgChannelQuery, [targetChannel]);
          const orgChannels = orgChannelResult.rows;
          // console.log(orgChannels);
          // return
          
      
          if (orgChannels.length === 0) {
            console.log('No valid orgIds found for Ajio.');
            return;
          }
      
          const orgIds = orgChannels.map(row => row.org_id);
      
          // Step 2: Fetch sync requests
        //   const syncRequestQuery = `
        //     SELECT requestid, orgid, channel, status, message, sources
        //     FROM "fs-sync-requests-db"
        //     WHERE createdAt > (CURRENT_DATE - INTERVAL '1 day') + INTERVAL '18:30'
        //       AND orgid = ANY($1)
        //       AND channel = $2
        //     ORDER BY createdAt;
        //   `;
          
        //   const syncRequestResult = await client.query(syncRequestQuery, [orgIds, targetChannel]);
      
          // Step 3: Validate reports
          const reportValidationQuery = `
            SELECT orgid, channel, report_type, status,message
            FROM fs_upload
            WHERE created_at > (CURRENT_DATE - INTERVAL '1 day') + INTERVAL '14:30'
              AND orgid = ANY($1)
              AND channel = $2;
          `;
          
          
          
          const reportValidationResult = await client.query(reportValidationQuery, [orgIds, targetChannel]);
          // console.log(reportValidationResult.rows);
          // return
          
        
          
      
          // Step 4: Process and calculate stats
          const channelStats = {
            total: 0,
            completed: 0,
            processing: 0,
            notCompleted: 0,
            sync_request_not_happen: 0,
            sync_request_not_happen_orgIds: [],
          };
      
        //   const syncRequestsByOrgChannel = {};
        //   syncRequestResult.rows.forEach(row => {
        //     const key = `${row.orgid}_${row.channel}`;
        //     syncRequestsByOrgChannel[key] = row;
        //   });
      
          const reportsByOrgChannel = {};
          reportValidationResult.rows.forEach(row => {
            const key = `${row.orgid}_${row.channel}`;
            if (!reportsByOrgChannel[key]) {
              reportsByOrgChannel[key] = [];
            }
            reportsByOrgChannel[key].push(row);
          });
      
          orgChannels.forEach(({ org_id, channel }) => {
            const key = `${org_id}_${channel}`;
            channelStats.total += 1;
      
            const syncRequest = reportsByOrgChannel[key] || [];
          // console.log(syncRequest);
          
          const sourceName = ['Profitability-Ajio','Orders','Soa','Return','Inventory']
            if (!syncRequest) {
              channelStats.sync_request_not_happen += 1;
              channelStats.sync_request_not_happen_orgIds.push(org_id);
              return;
            }
           
           
            const status = (syncRequest[0]?.status || '').toUpperCase();
          //  console.log(reportValidationQuery.rows.orgid);
          //  return
           const reports = reportsByOrgChannel[key] || [];
            if (status === 'COMPLETED'|| status === 'PROFIT TRIGGER') {
              
              const completedReports = reports.filter(
                report => report.report_type && report.status && (report.status.toUpperCase() === 'COMPLETED' || report.status.toUpperCase() ===  'PROFIT TRIGGER')
              );
              
              const matchingReports = completedReports.map(report => report.report_type)

              
              
              

              if (sourceName.every(type=> matchingReports.includes(type))){
                channelStats.completed += 1;
                // console.log(org_id,reports.map(report=> report.report_type));
                // console.log(org_id,reports.map(report=> ({type:report.report_type, message:report.message})));

              } else  {
                
                channelStats.notCompleted += 1;
                
              //  console.log(org_id);
               

                
              }

               //  Handle Reports That Did Not Complete
            const reportsNotCompleted = reports.filter(report => 
               report.status.toUpperCase() === 'ERROR'|| report.status.toUpperCase() === 'FAILED' || report.status.toUpperCase() === null
            );
          
            if (reportsNotCompleted.length > 0) {
              // console.log(` Reports Expected But Not Completed for OrgID: ${org_id}`);
              reportsNotCompleted.forEach(report => {
                console.log(`${org_id}, Report Type: ${report.report_type}, Status: ${report.status}, Message: ${report.message}`);
              });
            }
            } else if (status === 'PROCESSING') {
              channelStats.processing += 1;
            } else {
              // console.log(org_id);
                             

              channelStats.notCompleted += 1;
              console.log(org_id,reports.map(report=> ({type:report.report_type, message:report.message})));
              
            }

            // Get all report types that exist for this org_id
            const existingReportTypes = reports.map(report => report.report_type);

            // Find missing report types from sourceName that are not in existing reports
            const missingReports = sourceName.filter(type => !existingReportTypes.includes(type));

            if (missingReports.length > 0) {
              console.log(` Missing Reports for OrgID: ${org_id}`);
              missingReports.forEach(missingType => {
                console.log(`${org_id}, Report Type: ${missingType}, Status: NOT GENERATED`);
              });
            }
          });
      
          // Log results to the terminal
          console.log(`Channel: ${targetChannel}`);
          console.table({
            Total_OrgIds: channelStats.total,
            Completed: channelStats.completed,
            Processing: channelStats.processing,
            Not_Completed: channelStats.notCompleted,
            Sync_Request_Not_Happen: channelStats.sync_request_not_happen,
          });
          console.log('OrgIds for Sync_Request_Not_Happen:', channelStats.sync_request_not_happen_orgIds);
          break;
          
        } catch (error) {
          console.error(`Error occurred on attempt ${attempts}:`, error.message);
          
                if (attempts >= MAX_RETRIES) {
                  console.error('Max retry attempts reached. Exiting process.');
                  break;
                }
          
                console.log(`Retrying in 5 seconds...`);
                await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds before retrying
        } finally {
          if (client) {
            await client.end();
          }
        }
      }
      };
      
module.exports = AjioController;