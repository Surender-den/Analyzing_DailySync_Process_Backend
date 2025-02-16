const {Client} = require('pg');
const dotenv = require('dotenv');
const path = require('path');
const { channel } = require('diagnostics_channel');
const { report } = require('process');
dotenv.config({path:path.join(__dirname,'..','config','config.env')});

const AjioController = async () => {
    let client = null;
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
            WHERE org.channel = $1
              AND isSyncDisabled IS NOT TRUE
              AND (isDisabled != TRUE OR isDisabled IS NULL)
              AND (isDisconnected != TRUE OR isDisconnected IS NULL);
          `;
          const orgChannelResult = await client.query(orgChannelQuery, [targetChannel]);
          const orgChannels = orgChannelResult.rows;
      
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
            SELECT orgid, channel, report_type, status
            FROM fs_upload
            WHERE created_at > (CURRENT_DATE - INTERVAL '1 day') + INTERVAL '14:30'
              AND orgid = ANY($1)
              AND channel = $2;
          `;
          
          const reportValidationResult = await client.query(reportValidationQuery, [orgIds, targetChannel]);
      
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
          
            if (!syncRequest) {
              channelStats.sync_request_not_happen += 1;
              channelStats.sync_request_not_happen_orgIds.push(org_id);
              return;
            }
           
           
            const status = (syncRequest[0]?.status || '').toUpperCase();
          //  console.log(status);
           const reports = reportsByOrgChannel[key] || [];
            if (status === 'COMPLETED'||'PROFIT TRIGGER') {
              
              const completedReports = reports.filter(
                report => report.report_type && report.status && report.status.toUpperCase() === 'COMPLETED' || 'PROFIT TRIGGER'
              );
      
              if (
                completedReports.some(report => report.report_type === 'Profitability-Ajio') &&
                completedReports.some(report => report.report_type === 'Orders') &&
                completedReports.some(report => report.report_type === 'Soa') &&
                completedReports.some(report => report.report_type === 'Return') &&
                completedReports.some(report => report.report_type === 'Inventory')



              ) {
                channelStats.completed += 1;
              } else {
                console.log(org_id,reports.map(report=> report.report_type));
                
                channelStats.notCompleted += 1;
              }
            } else if (status === 'PROCESSING') {
              channelStats.processing += 1;
            } else {
              console.log(org_id);
                             

              channelStats.notCompleted += 1;
              
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
          
        } catch (error) {
          console.error('Error:', error);
        } finally {
          if (client) {
            await client.end();
          }
        }
      };
      
module.exports = AjioController;